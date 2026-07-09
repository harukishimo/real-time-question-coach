import { describe, expect, it } from "vitest";
import {
  COACH_TRANSCRIPT_MAX_FINALS,
  COACH_TRANSCRIPT_MIN_FINALS,
  buildCoachTopicStates,
  getCoachTranscriptWindow
} from "@/lib/coach-topic-state";
import { createSessionProfile } from "@/lib/session-profile";
import { createTranscriptSegment } from "@/lib/transcript";

const profile = createSessionProfile({
  conversationType: "requirements",
  industry: "it",
  purpose: "導入条件と運用方法を確認する",
  mustCheckItems: ["導入時期"],
  audioSource: "dummy",
  consentNoServerStorage: true
});

function segment(sequence: number, text: string, startedAtMs = sequence * 1_000) {
  return createTranscriptSegment({
    sequence,
    text,
    isFinal: true,
    startedAtMs,
    endedAtMs: startedAtMs + 900
  });
}

describe("coach topic state", () => {
  it("uses up to thirty final segments from the recent ninety-second window", () => {
    const segments = Array.from({ length: 40 }, (_, index) =>
      segment(index + 1, `確定発話${index + 1}`, index * 2_000)
    );
    const window = getCoachTranscriptWindow(segments);

    expect(window).toHaveLength(COACH_TRANSCRIPT_MAX_FINALS);
    expect(window[0].sequence).toBe(11);
    expect(window.at(-1)?.sequence).toBe(40);
  });

  it("expands to twenty finals when the ninety-second window is sparse", () => {
    const segments = Array.from({ length: 25 }, (_, index) =>
      segment(index + 1, `確定発話${index + 1}`, index * 10_000)
    );
    const window = getCoachTranscriptWindow(segments);

    expect(window).toHaveLength(COACH_TRANSCRIPT_MIN_FINALS);
    expect(window[0].sequence).toBe(6);
  });

  it("tracks covered and missing deep-dive dimensions for configured topics", () => {
    const states = buildCoachTopicStates({
      sessionProfile: profile,
      transcriptWindow: [
        segment(1, "導入時期は来月末までで、担当チームは営業部です。")
      ]
    });
    const topic = states.find((state) => state.label === "導入時期");

    expect(topic).toMatchObject({
      source: "session_setup",
      status: "partial"
    });
    expect(topic?.coveredDimensions).toEqual(expect.arrayContaining(["who", "when"]));
    expect(topic?.missingDimensions).toEqual(
      expect.arrayContaining(["why", "conditions", "examples", "exceptions"])
    );
    expect(topic?.evidence[0].text).toContain("来月末");
  });

  it("creates a partial conversation topic without requiring an ambiguous keyword", () => {
    const states = buildCoachTopicStates({
      sessionProfile: profile,
      transcriptWindow: [segment(1, "海外のランニングレースに参加する予定です。")]
    });
    const conversation = states.find((state) => state.source === "conversation");

    expect(conversation).toMatchObject({
      status: "partial",
      label: "直近発話の深掘り"
    });
    expect(conversation?.missingDimensions).toContain("why");
    expect(conversation?.evidence[0].text).toContain("ランニングレース");
  });
});
