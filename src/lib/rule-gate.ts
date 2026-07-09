import type {
  CoachCard,
  CoachCardCandidate,
  LocalRuleGateResult,
  SessionProfile,
  TranscriptSegment
} from "@/lib/types";

const DEFAULT_COOLDOWN_MS = 8_000;

export type LocalCoachContext = {
  latestFinal: TranscriptSegment | null;
  matchedImportantTerms: string[];
  matchedAmbiguousTerms: string[];
  unconfirmedIssues: string[];
  hasKnowledgeSignal: boolean;
  candidateSeeds: CoachCardCandidate[];
};

function includesAny(text: string, terms: string[]): string[] {
  return terms.filter((term) => term.length > 0 && text.includes(term));
}

function hasExistingCardForTerm(cards: CoachCard[], term: string): boolean {
  return cards.some(
    (card) =>
      card.title.includes(term) ||
      card.question.includes(term) ||
      card.reason.includes(term)
  );
}

function hasAnyCardWithQuestion(cards: CoachCard[], question: string): boolean {
  return cards.some((card) => card.question === question);
}

function hasAnyCardWithRule(cards: CoachCard[], ruleId: string): boolean {
  return cards.some((card) => card.ruleIds.includes(ruleId));
}

export function buildLocalCoachContext(input: {
  sessionProfile: SessionProfile;
  finalSegments: TranscriptSegment[];
  existingCards: CoachCard[];
}): LocalCoachContext {
  const latestFinal = input.finalSegments.at(-1) ?? null;

  if (!latestFinal) {
    return {
      latestFinal: null,
      matchedImportantTerms: [],
      matchedAmbiguousTerms: [],
      unconfirmedIssues: [],
      hasKnowledgeSignal: false,
      candidateSeeds: []
    };
  }

  const matchedImportantTerms = includesAny(
    latestFinal.text,
    input.sessionProfile.importantTerms
  ).filter((term) => !hasExistingCardForTerm(input.existingCards, term));
  const matchedAmbiguousTerms = includesAny(
    latestFinal.text,
    input.sessionProfile.ambiguousTerms
  ).filter((term) => !hasExistingCardForTerm(input.existingCards, term));
  const checklistItems = [
    ...input.sessionProfile.playbookMustCheck,
    ...input.sessionProfile.mustCheckItems
  ];
  const unconfirmedIssues = [...new Set(checklistItems)].filter(
    (item) =>
      !input.finalSegments.some((segment) => segment.text.includes(item)) &&
      !hasExistingCardForTerm(input.existingCards, item)
  );
  const hasKnowledgeSignal = matchedImportantTerms.length > 0 || matchedAmbiguousTerms.length > 0;

  const candidateSeeds: CoachCardCandidate[] = [];

  matchedImportantTerms.slice(0, 2).forEach((term) => {
    candidateSeeds.push({
      stableKey: `important:${term}`,
      title: `${term}の確認`,
      question: `${term}について、誰がいつ判断するのか確認しますか？`,
      reason: `直近の発話に重要語「${term}」が含まれています。`,
      priority: "high",
      score: 92,
      sourceSegmentIds: [latestFinal.id],
      ruleIds: ["important-term"]
    });
  });

  matchedAmbiguousTerms.slice(0, 1).forEach((term) => {
    candidateSeeds.push({
      stableKey: `ambiguous:${term}`,
      title: "曖昧表現の具体化",
      question: `「${term}」は、期限・条件・担当者でいうと何を指しますか？`,
      reason: `曖昧表現「${term}」が出ています。`,
      priority: "medium",
      score: 78,
      sourceSegmentIds: [latestFinal.id],
      ruleIds: ["ambiguous-expression"]
    });
  });

  if (hasKnowledgeSignal) {
    unconfirmedIssues.slice(0, 1).forEach((item) => {
      candidateSeeds.push({
        stableKey: `must-check:${item}`,
        title: "必須論点の未確認",
        question: `今回の目的に対して「${item}」は確認済みですか？`,
        reason: "Session Setupで指定された必須確認項目がまだ会話に出ていません。",
        priority: "medium",
        score: 74,
        sourceSegmentIds: [latestFinal.id],
        ruleIds: ["must-check-gap"]
      });
    });
  } else if (unconfirmedIssues.length > 0 && !hasAnyCardWithRule(input.existingCards, "context-bridge")) {
    candidateSeeds.push({
      stableKey: `context-bridge:${input.sessionProfile.id}:${latestFinal.sequence}`,
      title: "目的との接続確認",
      question: `今の話は「${input.sessionProfile.purpose}」のどの確認論点に接続しますか？`,
      reason: "直近の発話がSession Setupの目的や重要論点と直接結びついていません。",
      priority: "low",
      score: 62,
      sourceSegmentIds: [latestFinal.id],
      ruleIds: ["context-bridge"]
    });
  }

  const remainingSlots = Math.max(0, 3 - candidateSeeds.length);
  if (hasKnowledgeSignal) {
    input.sessionProfile.mustAskTemplates
      .filter((question) => !hasAnyCardWithQuestion(input.existingCards, question))
      .filter((question) => !candidateSeeds.some((seed) => seed.question === question))
      .slice(0, remainingSlots)
      .forEach((question, index) => {
        candidateSeeds.push({
          stableKey: `playbook:${input.sessionProfile.knowledgeSetId}:${index}:${question.slice(0, 16)}`,
          title: "ナレッジ推奨質問",
          question,
          reason: `${input.sessionProfile.playbookTitle}のナレッジに基づく確認候補です。`,
          priority: "medium",
          score: 68 - index,
          sourceSegmentIds: [latestFinal.id],
          ruleIds: ["playbook-question"]
        });
      });
  }

  return {
    latestFinal,
    matchedImportantTerms,
    matchedAmbiguousTerms,
    unconfirmedIssues,
    hasKnowledgeSignal,
    candidateSeeds
  };
}

export function evaluateLocalRuleGate(input: {
  sessionProfile: SessionProfile;
  finalSegments: TranscriptSegment[];
  existingCards: CoachCard[];
  lastLlmCallAt?: number;
  now?: number;
  cooldownMs?: number;
}): LocalRuleGateResult {
  const now = input.now ?? Date.now();
  const cooldownMs = input.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const lastLlmCallAt = input.lastLlmCallAt ?? 0;
  const nextAllowedAt = lastLlmCallAt + cooldownMs;
  const latestFinal = input.finalSegments.at(-1);

  if (!latestFinal) {
    return {
      shouldCallLlm: false,
      reasons: ["no_final_transcript"],
      candidateSeeds: [],
      nextAllowedAt
    };
  }

  if (now < nextAllowedAt) {
    return {
      shouldCallLlm: false,
      reasons: ["cooldown_active"],
      candidateSeeds: [],
      nextAllowedAt
    };
  }

  const context = buildLocalCoachContext({
    sessionProfile: input.sessionProfile,
    finalSegments: input.finalSegments,
    existingCards: input.existingCards
  });

  return {
    shouldCallLlm: context.candidateSeeds.length > 0,
    reasons:
      context.candidateSeeds.length > 0
        ? [...new Set(context.candidateSeeds.flatMap((candidate) => candidate.ruleIds))]
        : ["no_local_trigger"],
    candidateSeeds: context.candidateSeeds,
    nextAllowedAt
  };
}

export type CoachDispatchDecision =
  | {
      shouldDispatch: true;
      dispatchKey: string;
      reasons: string[];
      candidateSeeds: CoachCardCandidate[];
    }
  | {
      shouldDispatch: false;
      dispatchKey: string | null;
      reasons: string[];
    };

export function decideCoachDispatch(input: {
  sessionProfile: SessionProfile;
  segments: TranscriptSegment[];
  existingCards: CoachCard[];
  lastLlmCallAt?: number;
  lastDispatchKey?: string;
  inFlight?: boolean;
  manualRecheck?: boolean;
  now?: number;
  cooldownMs?: number;
}): CoachDispatchDecision {
  const finalSegments = input.segments.filter((segment) => segment.isFinal && segment.text.length > 0);
  const latestFinal = finalSegments.at(-1);

  if (!latestFinal) {
    return {
      shouldDispatch: false,
      dispatchKey: null,
      reasons: ["no_final_transcript"]
    };
  }

  const dispatchKey = [
    input.sessionProfile.id,
    latestFinal.id,
    latestFinal.sequence,
    input.manualRecheck ? "manual" : "auto"
  ].join(":");

  if (input.inFlight) {
    return {
      shouldDispatch: false,
      dispatchKey,
      reasons: ["dispatch_in_flight"]
    };
  }

  if (!input.manualRecheck && input.lastDispatchKey === dispatchKey) {
    return {
      shouldDispatch: false,
      dispatchKey,
      reasons: ["duplicate_dispatch"]
    };
  }

  const gate = evaluateLocalRuleGate({
    sessionProfile: input.sessionProfile,
    finalSegments,
    existingCards: input.existingCards,
    lastLlmCallAt: input.manualRecheck ? 0 : input.lastLlmCallAt,
    now: input.now,
    cooldownMs: input.cooldownMs
  });

  if (!gate.shouldCallLlm) {
    return {
      shouldDispatch: false,
      dispatchKey,
      reasons: gate.reasons
    };
  }

  return {
    shouldDispatch: true,
    dispatchKey,
    reasons: gate.reasons,
    candidateSeeds: gate.candidateSeeds
  };
}
