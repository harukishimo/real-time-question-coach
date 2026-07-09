import { normalizeSttProviderEvent } from "@/lib/transcript";
import type { TranscriptSegment } from "@/lib/types";

export const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export type RealtimeSttTranscriptEvent = {
  kind: "partial" | "final";
  providerItemId: string;
  text: string;
};

export type RealtimeTranscriptState = {
  partialsByItemId: Map<string, string>;
};

export type RealtimeSttConnection = {
  ready: Promise<void>;
  stop: () => void;
};

export type RealtimeDataChannelLike = {
  readyState?: RTCDataChannelState;
  send?: (data: string) => void;
  close: () => void;
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
  onmessage?: RTCDataChannel["onmessage"];
  onopen?: RTCDataChannel["onopen"];
  onclose?: RTCDataChannel["onclose"];
  onerror?: RTCDataChannel["onerror"];
};

export type RealtimePeerConnectionLike = {
  addTrack: (track: MediaStreamTrack, stream: MediaStream) => unknown;
  createDataChannel: (label: string) => RealtimeDataChannelLike;
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  setLocalDescription: (description: RTCSessionDescriptionInit) => Promise<void>;
  setRemoteDescription: (description: RTCSessionDescriptionInit) => Promise<void>;
  close: () => void;
};

type ConnectOpenAiRealtimeTranscriptionInput = {
  token: string;
  mediaStream: MediaStream;
  fetcher?: typeof fetch;
  peerConnectionFactory?: () => RealtimePeerConnectionLike;
  realtimeUrl?: string;
  commitIntervalMs?: number;
  now?: () => number;
  onTranscript: (event: RealtimeSttTranscriptEvent) => void;
  onStatus?: (status: "connecting" | "connected" | "disconnected" | "error") => void;
};

function sanitizeTranscriptText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

export function createRealtimeTranscriptState(): RealtimeTranscriptState {
  return {
    partialsByItemId: new Map()
  };
}

export function parseOpenAiRealtimeTranscriptEvent(
  raw: unknown,
  state: RealtimeTranscriptState
): RealtimeSttTranscriptEvent | null {
  if (!raw || typeof raw !== "object") return null;

  const event = raw as Record<string, unknown>;
  const type = typeof event.type === "string" ? event.type : "";
  const providerItemId =
    typeof event.item_id === "string" && event.item_id.length > 0 ? event.item_id : null;

  if (!providerItemId) return null;

  if (type === "conversation.item.input_audio_transcription.delta") {
    const delta = sanitizeTranscriptText(event.delta);
    if (!delta.trim()) return null;
    const accumulated = `${state.partialsByItemId.get(providerItemId) ?? ""}${delta}`;
    state.partialsByItemId.set(providerItemId, accumulated);
    return {
      kind: "partial",
      providerItemId,
      text: accumulated.trim()
    };
  }

  if (type === "conversation.item.input_audio_transcription.completed") {
    const transcript = sanitizeTranscriptText(event.transcript).trim();
    state.partialsByItemId.delete(providerItemId);
    if (!transcript) return null;
    return {
      kind: "final",
      providerItemId,
      text: transcript
    };
  }

  return null;
}

export function realtimeTranscriptEventToSegment(input: {
  event: RealtimeSttTranscriptEvent;
  sequence: number;
  now?: number;
}): TranscriptSegment | null {
  const normalized = normalizeSttProviderEvent(
    {
      type:
        input.event.kind === "final"
          ? "conversation.item.input_audio_transcription.completed"
          : "conversation.item.input_audio_transcription.delta",
      sequence: input.sequence,
      text: input.event.text,
      isFinal: input.event.kind === "final",
      startedAtMs: input.now ?? Date.now()
    },
    {
      fallbackSequence: input.sequence,
      now: input.now
    }
  );

  return normalized.ok ? normalized.segment : null;
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

function makeNativePeerConnection(): RealtimePeerConnectionLike {
  return new RTCPeerConnection();
}

function createMessageHandler(input: {
  transcriptState: RealtimeTranscriptState;
  onTranscript: (event: RealtimeSttTranscriptEvent) => void;
}): EventListener {
  return ((message: MessageEvent) => {
    try {
      const raw =
        typeof message.data === "string" ? JSON.parse(message.data) : JSON.parse(String(message.data));
      const transcriptEvent = parseOpenAiRealtimeTranscriptEvent(raw, input.transcriptState);
      if (transcriptEvent) {
        input.onTranscript(transcriptEvent);
      }
    } catch {
      // Provider lifecycle and malformed events are ignored; transcript text is never logged.
    }
  }) as EventListener;
}

function sendCommit(dataChannel: RealtimeDataChannelLike) {
  if (dataChannel.readyState !== "open" || !dataChannel.send) return;
  dataChannel.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
}

export async function connectOpenAiRealtimeTranscription(
  input: ConnectOpenAiRealtimeTranscriptionInput
): Promise<RealtimeSttConnection> {
  const audioTrack = input.mediaStream.getAudioTracks()[0];
  if (!audioTrack) {
    stopStream(input.mediaStream);
    throw new Error("Realtime STT requires an active audio track.");
  }

  input.onStatus?.("connecting");
  const fetcher = input.fetcher ?? fetch;
  const peerConnection = (input.peerConnectionFactory ?? makeNativePeerConnection)();
  const dataChannel = peerConnection.createDataChannel("oai-events");
  const transcriptState = createRealtimeTranscriptState();
  const messageHandler = createMessageHandler({
    transcriptState,
    onTranscript: input.onTranscript
  });
  let stopped = false;
  let commitTimer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (commitTimer) {
      clearInterval(commitTimer);
      commitTimer = null;
    }
    sendCommit(dataChannel);
    dataChannel.removeEventListener?.("message", messageHandler);
    dataChannel.onmessage = null;
    dataChannel.onopen = null;
    dataChannel.onclose = null;
    dataChannel.onerror = null;
    dataChannel.close();
    peerConnection.close();
    stopStream(input.mediaStream);
    input.onStatus?.("disconnected");
  };

  try {
    dataChannel.addEventListener?.("message", messageHandler);
    if (!dataChannel.addEventListener) {
      dataChannel.onmessage = (event) => messageHandler(event);
    }
    dataChannel.onopen = () => {
      sendCommit(dataChannel);
      commitTimer = setInterval(() => sendCommit(dataChannel), input.commitIntervalMs ?? 3_000);
    };
    dataChannel.onerror = () => input.onStatus?.("error");
    dataChannel.onclose = () => input.onStatus?.("disconnected");

    peerConnection.addTrack(audioTrack, input.mediaStream);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    if (!offer.sdp) {
      throw new Error("Realtime STT SDP offer was empty.");
    }

    const response = await fetcher(input.realtimeUrl ?? OPENAI_REALTIME_CALLS_URL, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/sdp"
      }
    });

    if (!response.ok) {
      throw new Error(`Realtime STT connection failed: ${response.status}`);
    }

    const answerSdp = await response.text();
    await peerConnection.setRemoteDescription({
      type: "answer",
      sdp: answerSdp
    });
    input.onStatus?.("connected");

    return {
      ready: Promise.resolve(),
      stop
    };
  } catch (error) {
    stop();
    throw error;
  }
}
