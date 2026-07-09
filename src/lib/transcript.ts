import type { SpeakerInfo, TranscriptSegment } from "@/lib/types";

export const UNKNOWN_SPEAKER: SpeakerInfo = {
  id: "unknown",
  label: "話者不明",
  source: "unknown",
  confidence: 0
};

export function createTranscriptSegment(input: {
  sequence: number;
  speaker?: SpeakerInfo;
  text: string;
  isFinal: boolean;
  startedAtMs: number;
  endedAtMs?: number;
}): TranscriptSegment {
  return {
    id: `seg-${input.sequence}-${input.isFinal ? "final" : "partial"}`,
    sequence: input.sequence,
    speaker: input.speaker ?? UNKNOWN_SPEAKER,
    text: input.text.trim(),
    isFinal: input.isFinal,
    startedAtMs: input.startedAtMs,
    endedAtMs: input.endedAtMs,
    createdAt: new Date().toISOString()
  };
}

export function mergeTranscriptSegment(
  currentSegments: TranscriptSegment[],
  nextSegment: TranscriptSegment
): TranscriptSegment[] {
  const withoutSameSequence = currentSegments.filter(
    (segment) => segment.sequence !== nextSegment.sequence
  );

  return [...withoutSameSequence, nextSegment].sort((a, b) => a.sequence - b.sequence);
}

export function getFinalTranscriptSegments(
  segments: TranscriptSegment[]
): TranscriptSegment[] {
  return segments.filter((segment) => segment.isFinal && segment.text.length > 0);
}

export function getRecentConversationBuffer(
  segments: TranscriptSegment[],
  maxSegments = 8
): TranscriptSegment[] {
  return getFinalTranscriptSegments(segments).slice(-maxSegments);
}

export function transcriptToPlainText(segments: TranscriptSegment[]): string {
  return segments
    .map((segment) => `${segment.speaker.label}: ${segment.text}`)
    .join("\n");
}

export type SttProviderEventNormalization =
  | {
      ok: true;
      segment: TranscriptSegment;
    }
  | {
      ok: false;
      code:
        | "malformed_event"
        | "empty_text"
        | "partial_timeout"
        | "missing_timestamp"
        | "unsupported_event";
      safeMessage: string;
    };

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

function normalizeSpeaker(value: unknown): SpeakerInfo {
  if (!value || typeof value !== "object") return UNKNOWN_SPEAKER;
  const source = value as Record<string, unknown>;
  const id = source.id === "user" || source.id === "participant" ? source.id : "unknown";
  const label =
    typeof source.label === "string" && source.label.trim().length > 0
      ? source.label.trim().slice(0, 40)
      : id === "user"
        ? "自分"
        : id === "participant"
          ? "相手"
          : "話者不明";
  const confidence =
    typeof source.confidence === "number" && Number.isFinite(source.confidence)
      ? Math.min(1, Math.max(0, source.confidence))
      : 0;

  return {
    id,
    label,
    source: id === "unknown" ? "unknown" : "provider",
    confidence
  };
}

export function normalizeSttProviderEvent(
  event: unknown,
  context: {
    fallbackSequence: number;
    now?: number;
  }
): SttProviderEventNormalization {
  if (!event || typeof event !== "object") {
    return {
      ok: false,
      code: "malformed_event",
      safeMessage: "STT event must be an object."
    };
  }

  const source = event as Record<string, unknown>;
  const type = typeof source.type === "string" ? source.type : "";
  const isFinal =
    source.isFinal === true ||
    source.final === true ||
    type.includes("final") ||
    type.includes("completed");

  if (!isFinal && (type.includes("timeout") || source.timeout === true)) {
    return {
      ok: false,
      code: "partial_timeout",
      safeMessage: "Partial STT event timed out before becoming final."
    };
  }

  const rawText = source.text ?? source.transcript ?? source.delta;
  const text = normalizeText(rawText);
  if (!text) {
    return {
      ok: false,
      code: "empty_text",
      safeMessage: "STT event text is empty."
    };
  }

  const sequence =
    typeof source.sequence === "number" && Number.isSafeInteger(source.sequence)
      ? source.sequence
      : context.fallbackSequence;
  const startedAtMs =
    typeof source.startedAtMs === "number" && Number.isFinite(source.startedAtMs)
      ? source.startedAtMs
      : typeof source.start_ms === "number" && Number.isFinite(source.start_ms)
        ? source.start_ms
        : context.now ?? Date.now();
  const endedAtMs =
    typeof source.endedAtMs === "number" && Number.isFinite(source.endedAtMs)
      ? source.endedAtMs
      : typeof source.end_ms === "number" && Number.isFinite(source.end_ms)
        ? source.end_ms
        : undefined;

  return {
    ok: true,
    segment: createTranscriptSegment({
      sequence,
      speaker: normalizeSpeaker(source.speaker),
      text,
      isFinal,
      startedAtMs,
      endedAtMs
    })
  };
}
