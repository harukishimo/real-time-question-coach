import { describe, expect, it } from "vitest";
import { createDummyTranscriptPair, getDummyTranscriptFixture } from "@/lib/dummy-transcript";
import {
  createTranscriptSegment,
  getRecentConversationBuffer,
  mergeTranscriptSegment,
  normalizeSttProviderEvent,
  transcriptToPlainText,
  UNKNOWN_SPEAKER
} from "@/lib/transcript";

describe("transcript and speaker info", () => {
  it("provides at least five final fixture segments per conversation type", () => {
    for (const conversationType of ["sales", "requirements", "recruiting", "user_research"] as const) {
      expect(getDummyTranscriptFixture(conversationType).length).toBeGreaterThanOrEqual(5);
    }
  });

  it("marks dummy fixture speaker info with source and confidence", () => {
    const pair = createDummyTranscriptPair("requirements", 0);

    expect(pair.final.speaker).toMatchObject({
      source: "fixture",
      confidence: 1
    });
    expect(pair.partial.isFinal).toBe(false);
    expect(pair.final.isFinal).toBe(true);
  });

  it("falls back to unknown speaker info when provider speaker is unavailable", () => {
    const segment = createTranscriptSegment({
      sequence: 1,
      text: "話者が判定できない発話",
      isFinal: true,
      startedAtMs: 0
    });

    expect(segment.speaker).toEqual(UNKNOWN_SPEAKER);
    expect(transcriptToPlainText([segment])).toContain("話者不明");
  });

  it("keeps only final segments in recent conversation buffer", () => {
    const partial = createTranscriptSegment({
      sequence: 1,
      text: "partial",
      isFinal: false,
      startedAtMs: 0
    });
    const final = createTranscriptSegment({
      sequence: 2,
      text: "final",
      isFinal: true,
      startedAtMs: 1000
    });

    expect(getRecentConversationBuffer([partial, final])).toEqual([final]);
  });

  it("normalizes provider partial and final events without trusting spoofed speaker ids", () => {
    const partial = normalizeSttProviderEvent(
      {
        type: "transcript.partial",
        sequence: 10,
        speaker: { id: "admin", label: "Admin", confidence: 99 },
        text: "  <script>ではなく普通の発話\u0000  ",
        startedAtMs: 100
      },
      { fallbackSequence: 1 }
    );
    const final = normalizeSttProviderEvent(
      {
        type: "transcript.final",
        sequence: 10,
        speaker: { id: "participant", label: "相手", confidence: 0.9 },
        transcript: "最終発話です",
        startedAtMs: 100,
        endedAtMs: 500
      },
      { fallbackSequence: 1 }
    );

    expect(partial).toMatchObject({
      ok: true,
      segment: {
        isFinal: false,
        speaker: {
          id: "unknown"
        }
      }
    });
    expect(final).toMatchObject({
      ok: true,
      segment: {
        isFinal: true,
        text: "最終発話です",
        speaker: {
          id: "participant"
        }
      }
    });
  });

  it("rejects malformed, empty, and timed-out partial provider events safely", () => {
    expect(normalizeSttProviderEvent(null, { fallbackSequence: 1 })).toMatchObject({
      ok: false,
      code: "malformed_event"
    });
    expect(normalizeSttProviderEvent({ text: "   " }, { fallbackSequence: 1 })).toMatchObject({
      ok: false,
      code: "empty_text"
    });
    expect(
      normalizeSttProviderEvent({ type: "partial.timeout", text: "未確定", timeout: true }, { fallbackSequence: 1 })
    ).toMatchObject({
      ok: false,
      code: "partial_timeout"
    });
  });

  it("handles duplicate final and out-of-order segments by stable sequence ordering", () => {
    const first = createTranscriptSegment({
      sequence: 2,
      text: "古いfinal",
      isFinal: true,
      startedAtMs: 200
    });
    const replacement = createTranscriptSegment({
      sequence: 2,
      text: "新しいfinal",
      isFinal: true,
      startedAtMs: 220
    });
    const earlier = createTranscriptSegment({
      sequence: 1,
      text: "先の発話",
      isFinal: true,
      startedAtMs: 100
    });

    expect(mergeTranscriptSegment(mergeTranscriptSegment([first], earlier), replacement)).toEqual([
      earlier,
      replacement
    ]);
  });

  it("normalizes long unicode text and ignores secret-like extra provider fields", () => {
    const normalized = normalizeSttProviderEvent(
      {
        type: "transcript.final",
        sequence: 3,
        text: " 日本語とEnglishと記号🙂を含む長い発話 ".repeat(20),
        speaker: { id: "participant", label: "相手", confidence: 0.8 },
        authorization: "Bearer sk-secret-field",
        providerRaw: {
          api_key: "sk-secret-field"
        }
      },
      { fallbackSequence: 3 }
    );

    expect(normalized).toMatchObject({
      ok: true,
      segment: {
        isFinal: true,
        speaker: {
          id: "participant"
        }
      }
    });
    expect(JSON.stringify(normalized)).not.toContain("sk-secret-field");
  });
});
