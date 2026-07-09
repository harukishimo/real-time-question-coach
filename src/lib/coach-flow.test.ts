import { describe, expect, it } from "vitest";
import { applyCoachCardCandidates, countCardsByStatus, updateCardStatus } from "@/lib/coach-card";
import { createDummyTranscriptPair } from "@/lib/dummy-transcript";
import {
  DEFAULT_CONTEXT_REVIEW_INTERVAL_MS,
  buildLocalCoachContext,
  decideCoachDispatch,
  evaluateLocalRuleGate
} from "@/lib/rule-gate";
import { createSessionProfile } from "@/lib/session-profile";
import type { CoachCard, CoachCardCandidate } from "@/lib/types";

const profile = createSessionProfile({
  conversationType: "requirements",
  industry: "it",
  purpose: "要件とリスクを確認する",
  mustCheckItems: ["権限", "保存方針"],
  audioSource: "dummy",
  consentNoServerStorage: true
});

function candidate(index: number): CoachCardCandidate {
  return {
    stableKey: `test-${index}`,
    title: `確認${index}`,
    question: `質問${index}は確認済みですか？`,
    reason: "test",
    priority: "medium",
    score: 70 + index,
    sourceSegmentIds: [`seg-${index}`],
    ruleIds: ["test-rule"]
  };
}

function scoredCandidate(index: number, score: number): CoachCardCandidate {
  return {
    ...candidate(index),
    score
  };
}

function existingCard(index: number, score: number, status: CoachCard["status"] = "active"): CoachCard {
  return {
    id: `existing-${index}`,
    title: `既存確認${index}`,
    question: `既存質問${index}は確認済みですか？`,
    reason: "existing",
    priority: "medium",
    score,
    status,
    sourceSegmentIds: [`seg-existing-${index}`],
    ruleIds: ["existing-rule"],
    createdAt: new Date(0).toISOString()
  };
}

describe("coach flow", () => {
  it("does not trigger on partial-only input and triggers on important final segments", () => {
    const pair = createDummyTranscriptPair("requirements", 0);

    expect(
      evaluateLocalRuleGate({
        sessionProfile: profile,
        finalSegments: [],
        existingCards: [],
        now: 20_000
      }).shouldCallLlm
    ).toBe(false);

    const result = evaluateLocalRuleGate({
      sessionProfile: profile,
      finalSegments: [pair.final],
      existingCards: [],
      now: 20_000
    });

    expect(result.shouldCallLlm).toBe(true);
    expect(result.reasons).toContain("important-term");
  });

  it("uses playbook must-check items even when setup has no custom must-check text", () => {
    const playbookOnlyProfile = createSessionProfile({
      conversationType: "user_research",
      industry: "it",
      purpose: "ユーザー調査で課題を確認する",
      mustCheckItems: [],
      audioSource: "dummy",
      consentNoServerStorage: true
    });
    const pair = createDummyTranscriptPair("user_research", 0);
    const result = evaluateLocalRuleGate({
      sessionProfile: playbookOnlyProfile,
      finalSegments: [pair.final],
      existingCards: [],
      now: 20_000
    });

    expect(result.shouldCallLlm).toBe(true);
    expect(result.reasons).toContain("must-check-gap");
    expect(result.candidateSeeds.some((seed) => seed.stableKey.startsWith("must-check:"))).toBe(
      true
    );
  });

  it("uses a bridge card instead of repeated checklist cards when latest transcript is unrelated", () => {
    const result = evaluateLocalRuleGate({
      sessionProfile: profile,
      finalSegments: [
        {
          id: "seg-general-final",
          sequence: 1,
          speaker: { id: "participant", label: "相手", source: "provider", confidence: 0.9 },
          text: "まずは全体像から順番に話します。",
          isFinal: true,
          startedAtMs: 0,
          endedAtMs: 1000,
          createdAt: new Date(0).toISOString()
        }
      ],
      existingCards: [],
      now: 20_000
    });

    expect(result.shouldCallLlm).toBe(true);
    expect(result.reasons).toEqual(["context-bridge"]);
    expect(result.candidateSeeds).toHaveLength(1);
    expect(result.candidateSeeds[0].question).toContain(profile.purpose);
    expect(result.candidateSeeds[0].question).not.toContain("MVPで必ず成立させる業務成果");
  });

  it("reviews a growing transcript window every twenty seconds after the first bridge card", () => {
    const finalSegment = {
      id: "seg-window-review",
      sequence: 2,
      speaker: { id: "participant", label: "相手", source: "provider", confidence: 0.9 },
      text: "その後の話をもう少し続けます。",
      isFinal: true,
      startedAtMs: 1000,
      endedAtMs: 2000,
      createdAt: new Date(1000).toISOString()
    } as const;
    const bridgeCard = {
      ...existingCard(1, 62),
      title: "目的との接続確認",
      question: `今の話は「${profile.purpose}」のどの確認論点に接続しますか？`,
      ruleIds: ["context-bridge"]
    };
    const lastLlmCallAt = 10_000;

    expect(
      evaluateLocalRuleGate({
        sessionProfile: profile,
        finalSegments: [finalSegment],
        existingCards: [bridgeCard],
        lastLlmCallAt,
        now: lastLlmCallAt + DEFAULT_CONTEXT_REVIEW_INTERVAL_MS - 1
      })
    ).toMatchObject({
      shouldCallLlm: false,
      reasons: ["no_local_trigger"]
    });

    expect(
      evaluateLocalRuleGate({
        sessionProfile: profile,
        finalSegments: [finalSegment],
        existingCards: [bridgeCard],
        lastLlmCallAt,
        now: lastLlmCallAt + DEFAULT_CONTEXT_REVIEW_INTERVAL_MS
      })
    ).toMatchObject({
      shouldCallLlm: true,
      reasons: ["transcript_window_review"],
      candidateSeeds: []
    });
  });

  it("manual recheck reaches the provider even when there is no local candidate", () => {
    const bridgeCard = {
      ...existingCard(1, 62),
      title: "目的との接続確認",
      question: `今の話は「${profile.purpose}」のどの確認論点に接続しますか？`,
      ruleIds: ["context-bridge"]
    };

    expect(
      evaluateLocalRuleGate({
        sessionProfile: profile,
        finalSegments: [
          {
            id: "seg-manual-review",
            sequence: 2,
            speaker: { id: "participant", label: "相手", source: "provider", confidence: 0.9 },
            text: "引き続き一般的な話をしています。",
            isFinal: true,
            startedAtMs: 1000,
            endedAtMs: 2000,
            createdAt: new Date(1000).toISOString()
          }
        ],
        existingCards: [bridgeCard],
        lastLlmCallAt: 30_000,
        manualRecheck: true,
        now: 30_100
      })
    ).toMatchObject({
      shouldCallLlm: true,
      reasons: ["manual_recheck"],
      candidateSeeds: []
    });
  });

  it("fills local fallback cards with playbook questions only when latest transcript has knowledge signals", () => {
    const result = evaluateLocalRuleGate({
      sessionProfile: profile,
      finalSegments: [
        {
          id: "seg-signal-final",
          sequence: 1,
          speaker: { id: "participant", label: "相手", source: "provider", confidence: 0.9 },
          text: "履歴を残す必要があります。",
          isFinal: true,
          startedAtMs: 0,
          endedAtMs: 1000,
          createdAt: new Date(0).toISOString()
        }
      ],
      existingCards: [],
      now: 20_000
    });

    expect(result.shouldCallLlm).toBe(true);
    expect(result.reasons).toContain("playbook-question");
    expect(result.candidateSeeds.length).toBeGreaterThanOrEqual(2);
    expect(result.candidateSeeds.some((seed) => seed.question.includes("MVP"))).toBe(true);
  });

  it("does not repeat playbook template questions already shown", () => {
    const existing = existingCard(1, 90);
    existing.question = profile.mustAskTemplates[0];

    const result = evaluateLocalRuleGate({
      sessionProfile: profile,
      finalSegments: [
        {
          id: "seg-repeat-final",
          sequence: 1,
          speaker: { id: "participant", label: "相手", source: "provider", confidence: 0.9 },
          text: "概要を共有します。",
          isFinal: true,
          startedAtMs: 0,
          endedAtMs: 1000,
          createdAt: new Date(0).toISOString()
        }
      ],
      existingCards: [existing],
      now: 20_000
    });

    expect(result.candidateSeeds.map((seed) => seed.question)).not.toContain(profile.mustAskTemplates[0]);
  });

  it("suppresses repeated topics across active, queued, and done cards", () => {
    const final = {
      id: "seg-topic-final",
      sequence: 1,
      speaker: { id: "participant", label: "相手", source: "provider", confidence: 0.9 },
      text: "権限について話します。",
      isFinal: true,
      startedAtMs: 0,
      endedAtMs: 1000,
      createdAt: new Date(0).toISOString()
    } as const;
    const context = buildLocalCoachContext({
      sessionProfile: profile,
      finalSegments: [final],
      existingCards: [
        {
          ...existingCard(1, 90, "active"),
          title: "権限の確認",
          question: "権限について誰が判断しますか？"
        },
        {
          ...existingCard(2, 80, "queued"),
          title: "保存方針の確認",
          question: "保存方針は確認済みですか？"
        },
        {
          ...existingCard(3, 70, "done"),
          title: "導入時期の確認",
          question: "導入時期は確認済みですか？"
        }
      ]
    });

    expect(context.matchedImportantTerms).not.toContain("権限");
    expect(context.unconfirmedIssues).not.toContain("権限");
    expect(context.unconfirmedIssues).not.toContain("保存方針");
    expect(context.candidateSeeds.map((seed) => seed.question).join("\n")).not.toContain(
      "権限について、誰がいつ判断"
    );
  });

  it("keeps active coach cards capped at three", () => {
    const cards = applyCoachCardCandidates(
      [],
      [candidate(1), candidate(2), candidate(3), candidate(4), candidate(5)]
    );

    expect(countCardsByStatus(cards).active).toBe(3);
    expect(countCardsByStatus(cards).queued).toBe(2);
  });

  it("promotes queued cards after a user action", () => {
    const cards = applyCoachCardCandidates(
      [],
      [candidate(1), candidate(2), candidate(3), candidate(4)]
    );
    const updated = updateCardStatus(cards, cards[0].id, "done");

    expect(countCardsByStatus(updated).active).toBe(3);
    expect(countCardsByStatus(updated).queued).toBe(0);
    expect(countCardsByStatus(updated).done).toBe(1);
  });

  it("replaces the lowest non-pinned active card when a higher score candidate arrives", () => {
    const cards = applyCoachCardCandidates(
      [],
      [scoredCandidate(1, 61), scoredCandidate(2, 70), scoredCandidate(3, 80)]
    );
    const updated = applyCoachCardCandidates(cards, [scoredCandidate(9, 99)]);

    const activeCards = updated.filter((card) => card.status === "active");
    const queuedCards = updated.filter((card) => card.status === "queued");

    expect(countCardsByStatus(updated).active).toBe(3);
    expect(activeCards.map((card) => card.score).sort((a, b) => a - b)).toEqual([70, 80, 99]);
    expect(queuedCards.map((card) => card.score)).toContain(61);
  });

  it("does not demote pinned cards when all active slots are pinned", () => {
    const cards = applyCoachCardCandidates(
      [],
      [scoredCandidate(1, 61), scoredCandidate(2, 70), scoredCandidate(3, 80)]
    );
    const pinned = cards.map((card) => ({
      ...card,
      status: "pinned" as const
    }));
    const updated = applyCoachCardCandidates(pinned, [scoredCandidate(9, 99)]);

    expect(countCardsByStatus(updated).active).toBe(3);
    expect(countCardsByStatus(updated).queued).toBe(1);
    expect(updated.filter((card) => card.status === "pinned")).toHaveLength(3);
  });

  it("normalizes pre-existing active cards before returning coach results", () => {
    const updated = applyCoachCardCandidates(
      [
        existingCard(1, 91),
        existingCard(2, 72),
        existingCard(3, 83),
        existingCard(4, 64)
      ],
      []
    );

    expect(countCardsByStatus(updated).active).toBe(3);
    expect(countCardsByStatus(updated).queued).toBe(1);
    expect(updated.filter((card) => card.status === "active").map((card) => card.score).sort()).toEqual([
      72,
      83,
      91
    ]);
  });

  it("normalizes pre-existing active cards even when client-supplied ids are duplicated", () => {
    const updated = applyCoachCardCandidates(
      [
        { ...existingCard(1, 91), id: "duplicate" },
        { ...existingCard(2, 72), id: "duplicate" },
        { ...existingCard(3, 83), id: "duplicate" },
        { ...existingCard(4, 64), id: "duplicate" }
      ],
      []
    );

    expect(countCardsByStatus(updated).active).toBe(3);
    expect(countCardsByStatus(updated).queued).toBe(1);
  });

  it("promotes queued cards by slot count even when queued ids are duplicated", () => {
    const updated = applyCoachCardCandidates(
      [
        existingCard(1, 91),
        existingCard(2, 72),
        { ...existingCard(3, 83, "queued"), id: "duplicate-queued" },
        { ...existingCard(4, 64, "queued"), id: "duplicate-queued" },
        { ...existingCard(5, 95, "queued"), id: "duplicate-queued" }
      ],
      []
    );

    expect(countCardsByStatus(updated).active).toBe(3);
    expect(countCardsByStatus(updated).queued).toBe(2);
  });

  it("does not demote a pinned card that shares an id with the lowest active card", () => {
    const updated = applyCoachCardCandidates(
      [
        { ...existingCard(1, 100, "pinned"), id: "duplicate" },
        { ...existingCard(2, 10, "active"), id: "duplicate" },
        existingCard(3, 20, "active")
      ],
      [scoredCandidate(9, 92)]
    );

    expect(countCardsByStatus(updated).active).toBe(3);
    expect(updated.find((card) => card.id === "duplicate" && card.score === 100)?.status).toBe(
      "pinned"
    );
    expect(updated.find((card) => card.id === "duplicate" && card.score === 10)?.status).toBe(
      "queued"
    );
  });

  it("keeps LLM dispatch final-only, idempotent, cooldown-aware, and manual-recheck explicit", () => {
    const pair = createDummyTranscriptPair("requirements", 0);

    expect(
      decideCoachDispatch({
        sessionProfile: profile,
        segments: [pair.partial],
        existingCards: [],
        now: 30_000
      })
    ).toMatchObject({
      shouldDispatch: false,
      reasons: ["no_final_transcript"]
    });

    const first = decideCoachDispatch({
      sessionProfile: profile,
      segments: [pair.final],
      existingCards: [],
      now: 30_000
    });
    expect(first).toMatchObject({
      shouldDispatch: true
    });

    expect(
      decideCoachDispatch({
        sessionProfile: profile,
        segments: [pair.final],
        existingCards: [],
        lastDispatchKey: first.dispatchKey ?? undefined,
        now: 30_001
      })
    ).toMatchObject({
      shouldDispatch: false,
      reasons: ["duplicate_dispatch"]
    });

    expect(
      decideCoachDispatch({
        sessionProfile: profile,
        segments: [pair.final],
        existingCards: [],
        inFlight: true,
        now: 30_002
      })
    ).toMatchObject({
      shouldDispatch: false,
      reasons: ["dispatch_in_flight"]
    });

    expect(
      decideCoachDispatch({
        sessionProfile: profile,
        segments: [pair.final],
        existingCards: [],
        lastLlmCallAt: 30_000,
        now: 30_100
      })
    ).toMatchObject({
      shouldDispatch: false,
      reasons: ["cooldown_active"]
    });

    expect(
      decideCoachDispatch({
        sessionProfile: profile,
        segments: [pair.final],
        existingCards: [],
        lastLlmCallAt: 30_000,
        manualRecheck: true,
        now: 30_100
      })
    ).toMatchObject({
      shouldDispatch: true
    });
  });
});
