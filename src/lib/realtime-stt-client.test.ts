import { describe, expect, it, vi } from "vitest";
import {
  connectOpenAiRealtimeTranscription,
  parseOpenAiRealtimeTranscriptEvent,
  realtimeTranscriptEventToSegment,
  createRealtimeTranscriptState,
  type RealtimeDataChannelLike,
  type RealtimePeerConnectionLike
} from "@/lib/realtime-stt-client";

class FakeDataChannel implements RealtimeDataChannelLike {
  readyState: RTCDataChannelState = "connecting";
  sent: string[] = [];
  close = vi.fn();
  onmessage: ((event: MessageEvent) => void) | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, EventListener[]>();

  send(data: string) {
    this.sent.push(data);
  }

  addEventListener(type: string, listener: EventListener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener)
    );
  }

  emitMessage(data: unknown) {
    const event = { data } as MessageEvent;
    for (const listener of this.listeners.get("message") ?? []) {
      listener(event);
    }
    this.onmessage?.(event);
  }

  open() {
    this.readyState = "open";
    this.onopen?.();
  }
}

class FakePeerConnection implements RealtimePeerConnectionLike {
  addTrack = vi.fn();
  createDataChannel = vi.fn(() => this.dataChannel);
  createOffer = vi.fn(async () => ({ type: "offer" as const, sdp: "offer-sdp" }));
  setLocalDescription = vi.fn(async () => undefined);
  setRemoteDescription = vi.fn(async () => undefined);
  close = vi.fn();

  constructor(readonly dataChannel: FakeDataChannel) {}
}

function mediaStream(input?: {
  audioTrack?: Partial<MediaStreamTrack> | null;
  extraTrack?: Partial<MediaStreamTrack>;
}): MediaStream {
  const audioTrack =
    input?.audioTrack === null
      ? null
      : ({
          kind: "audio",
          stop: vi.fn(),
          ...input?.audioTrack
        } as unknown as MediaStreamTrack);
  const extraTrack = input?.extraTrack
    ? ({
        kind: "video",
        stop: vi.fn(),
        ...input.extraTrack
      } as unknown as MediaStreamTrack)
    : null;
  const tracks = [audioTrack, extraTrack].filter(Boolean) as MediaStreamTrack[];

  return {
    getAudioTracks: () => (audioTrack ? [audioTrack] : []),
    getTracks: () => tracks
  } as unknown as MediaStream;
}

describe("OpenAI Realtime STT browser client", () => {
  it("adds only the browser audio track and posts SDP with an ephemeral token", async () => {
    const dataChannel = new FakeDataChannel();
    const peerConnection = new FakePeerConnection(dataChannel);
    const audioTrack = { kind: "audio", stop: vi.fn() } as unknown as MediaStreamTrack;
    const videoTrack = { kind: "video", stop: vi.fn() } as unknown as MediaStreamTrack;
    const stream = mediaStream({ audioTrack, extraTrack: videoTrack });
    const fetcher = vi.fn(async () => new Response("answer-sdp", { status: 200 }));

    const connection = await connectOpenAiRealtimeTranscription({
      token: "ephemeral-token",
      mediaStream: stream,
      fetcher: fetcher as unknown as typeof fetch,
      peerConnectionFactory: () => peerConnection,
      onTranscript: vi.fn()
    });

    expect(peerConnection.addTrack).toHaveBeenCalledWith(audioTrack, stream);
    expect(peerConnection.addTrack).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/calls",
      expect.objectContaining({
        method: "POST",
        body: "offer-sdp",
        headers: {
          Authorization: "Bearer ephemeral-token",
          "Content-Type": "application/sdp"
        }
      })
    );
    expect(peerConnection.setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "answer-sdp"
    });

    connection.stop();
    expect(audioTrack.stop).toHaveBeenCalledTimes(1);
    expect(videoTrack.stop).toHaveBeenCalledTimes(1);
  });

  it("maps delta and completed data-channel events into partial and final transcript events", () => {
    const state = createRealtimeTranscriptState();

    expect(
      parseOpenAiRealtimeTranscriptEvent(
        {
          type: "conversation.item.input_audio_transcription.delta",
          item_id: "item-1",
          delta: "Hello"
        },
        state
      )
    ).toEqual({
      kind: "partial",
      providerItemId: "item-1",
      text: "Hello"
    });
    expect(
      parseOpenAiRealtimeTranscriptEvent(
        {
          type: "conversation.item.input_audio_transcription.delta",
          item_id: "item-1",
          delta: ", world"
        },
        state
      )
    ).toEqual({
      kind: "partial",
      providerItemId: "item-1",
      text: "Hello, world"
    });
    expect(
      parseOpenAiRealtimeTranscriptEvent(
        {
          type: "conversation.item.input_audio_transcription.completed",
          item_id: "item-1",
          transcript: "Hello, world"
        },
        state
      )
    ).toEqual({
      kind: "final",
      providerItemId: "item-1",
      text: "Hello, world"
    });
  });

  it("ignores malformed provider events and converts accepted events to unknown-speaker segments", () => {
    const state = createRealtimeTranscriptState();
    expect(parseOpenAiRealtimeTranscriptEvent("not-json", state)).toBeNull();
    expect(parseOpenAiRealtimeTranscriptEvent({ type: "unknown" }, state)).toBeNull();

    const segment = realtimeTranscriptEventToSegment({
      event: {
        kind: "final",
        providerItemId: "item-2",
        text: "次に確認するべき論点です"
      },
      sequence: 7,
      now: 1000
    });

    expect(segment).toMatchObject({
      sequence: 7,
      isFinal: true,
      text: "次に確認するべき論点です",
      speaker: {
        id: "unknown",
        source: "unknown"
      }
    });
  });

  it("dispatches data-channel transcript events through the active connection", async () => {
    const dataChannel = new FakeDataChannel();
    const peerConnection = new FakePeerConnection(dataChannel);
    const onTranscript = vi.fn();

    await connectOpenAiRealtimeTranscription({
      token: "ephemeral-token",
      mediaStream: mediaStream(),
      fetcher: vi.fn(async () => new Response("answer-sdp", { status: 200 })) as unknown as typeof fetch,
      peerConnectionFactory: () => peerConnection,
      onTranscript
    });

    dataChannel.emitMessage(
      JSON.stringify({
        type: "conversation.item.input_audio_transcription.completed",
        item_id: "item-3",
        transcript: "確定した発話"
      })
    );

    expect(onTranscript).toHaveBeenCalledWith({
      kind: "final",
      providerItemId: "item-3",
      text: "確定した発話"
    });
  });

  it("fails closed and stops tracks when no audio track is available", async () => {
    const videoTrack = { kind: "video", stop: vi.fn() } as unknown as MediaStreamTrack;
    const fetcher = vi.fn();

    await expect(
      connectOpenAiRealtimeTranscription({
        token: "ephemeral-token",
        mediaStream: mediaStream({
          audioTrack: null,
          extraTrack: videoTrack
        }),
        fetcher: fetcher as unknown as typeof fetch,
        peerConnectionFactory: () => new FakePeerConnection(new FakeDataChannel()),
        onTranscript: vi.fn()
      })
    ).rejects.toThrow("active audio track");

    expect(videoTrack.stop).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends a final commit and closes peer resources on stop", async () => {
    const dataChannel = new FakeDataChannel();
    const peerConnection = new FakePeerConnection(dataChannel);
    const track = { kind: "audio", stop: vi.fn() } as unknown as MediaStreamTrack;
    const connection = await connectOpenAiRealtimeTranscription({
      token: "ephemeral-token",
      mediaStream: mediaStream({ audioTrack: track }),
      fetcher: vi.fn(async () => new Response("answer-sdp", { status: 200 })) as unknown as typeof fetch,
      peerConnectionFactory: () => peerConnection,
      onTranscript: vi.fn()
    });

    dataChannel.open();
    connection.stop();

    expect(dataChannel.sent).toContain(JSON.stringify({ type: "input_audio_buffer.commit" }));
    expect(dataChannel.close).toHaveBeenCalledTimes(1);
    expect(peerConnection.close).toHaveBeenCalledTimes(1);
    expect(track.stop).toHaveBeenCalledTimes(1);
  });
});
