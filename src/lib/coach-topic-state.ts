import { getFinalTranscriptSegments } from "@/lib/transcript";
import type {
  CoachDeepDiveDimension,
  SessionProfile,
  TranscriptSegment
} from "@/lib/types";

export const COACH_TRANSCRIPT_WINDOW_MS = 90_000;
export const COACH_TRANSCRIPT_MIN_FINALS = 20;
export const COACH_TRANSCRIPT_MAX_FINALS = 30;

export const COACH_DEEP_DIVE_DIMENSIONS = [
  "who",
  "why",
  "when",
  "conditions",
  "examples",
  "exceptions"
] as const;

export type CoachTopicStatus = "not_started" | "partial" | "confirmed";
export type CoachTopicSource = "session_setup" | "playbook" | "conversation";

export type CoachTopicEvidence = {
  speaker: string;
  text: string;
};

export type CoachTopicState = {
  id: string;
  label: string;
  source: CoachTopicSource;
  status: CoachTopicStatus;
  coveredDimensions: CoachDeepDiveDimension[];
  missingDimensions: CoachDeepDiveDimension[];
  evidence: CoachTopicEvidence[];
};

const DIMENSION_PATTERNS: Record<CoachDeepDiveDimension, RegExp> = {
  who: /誰|担当|責任|決裁|承認者|利用者|関係者|部門|チーム|役割|ロール/,
  why: /なぜ|理由|背景|目的|課題|困|きっかけ|ため|ので/,
  when: /いつ|期限|時期|日程|まで|今月|来月|年内|週|月|日|早め|遅くとも/,
  conditions: /条件|場合|なら|とき|のみ|必要|前提|基準|次第|依存/,
  examples: /例えば|たとえば|具体|実例|事例|ケース|一件|1件|場面/,
  exceptions: /例外|失敗|エラー|キャンセル|差し戻し|期限超過|重複|通常以外|それ以外/
};

function segmentTime(segment: TranscriptSegment): number {
  return segment.endedAtMs ?? segment.startedAtMs;
}

export function getCoachTranscriptWindow(
  segments: TranscriptSegment[]
): TranscriptSegment[] {
  const finalSegments = getFinalTranscriptSegments(segments).slice(-COACH_TRANSCRIPT_MAX_FINALS);
  const latest = finalSegments.at(-1);
  if (!latest) return [];

  const latestTime = segmentTime(latest);
  const timeBounded = finalSegments.filter(
    (segment) => latestTime - segmentTime(segment) <= COACH_TRANSCRIPT_WINDOW_MS
  );
  const minimumCount = Math.min(COACH_TRANSCRIPT_MIN_FINALS, finalSegments.length);

  if (timeBounded.length >= minimumCount) {
    return timeBounded;
  }

  return finalSegments.slice(-minimumCount);
}

function topicTerms(label: string, sessionProfile: SessionProfile): string[] {
  const fragments = label
    .split(/、|・|\/|／|\(|\)|（|）|および|または|ならびに|と/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
  const knowledgeTerms = sessionProfile.importantTerms.filter(
    (term) => term.length >= 2 && label.includes(term)
  );

  return [...new Set([label, ...fragments, ...knowledgeTerms])];
}

function coveredDimensions(evidence: CoachTopicEvidence[]): CoachDeepDiveDimension[] {
  const text = evidence.map((item) => item.text).join("\n");
  return COACH_DEEP_DIVE_DIMENSIONS.filter((dimension) =>
    DIMENSION_PATTERNS[dimension].test(text)
  );
}

function buildTopicState(input: {
  id: string;
  label: string;
  source: CoachTopicSource;
  evidence: CoachTopicEvidence[];
}): CoachTopicState {
  const covered = coveredDimensions(input.evidence);
  const missing = COACH_DEEP_DIVE_DIMENSIONS.filter(
    (dimension) => !covered.includes(dimension)
  );
  const status: CoachTopicStatus =
    input.evidence.length === 0
      ? "not_started"
      : missing.length === 0
        ? "confirmed"
        : "partial";

  return {
    id: input.id,
    label: input.label,
    source: input.source,
    status,
    coveredDimensions: covered,
    missingDimensions: missing,
    evidence: input.evidence.slice(-2)
  };
}

function evidenceForTopic(
  label: string,
  sessionProfile: SessionProfile,
  transcriptWindow: TranscriptSegment[]
): CoachTopicEvidence[] {
  const terms = topicTerms(label, sessionProfile);

  return transcriptWindow
    .filter((segment) => terms.some((term) => segment.text.includes(term)))
    .map((segment) => ({
      speaker: segment.speaker.label,
      text: segment.text
    }))
    .slice(-2);
}

function topicPriority(state: CoachTopicState): number {
  const statusPriority = {
    partial: 0,
    not_started: 1,
    confirmed: 2
  }[state.status];
  const sourcePriority = {
    conversation: 0,
    session_setup: 1,
    playbook: 2
  }[state.source];

  return statusPriority * 10 + sourcePriority;
}

export function buildCoachTopicStates(input: {
  sessionProfile: SessionProfile;
  transcriptWindow: TranscriptSegment[];
}): CoachTopicState[] {
  const configuredTopics = [
    ...input.sessionProfile.mustCheckItems.map((label, index) => ({
      id: `setup:${index}`,
      label,
      source: "session_setup" as const
    })),
    ...input.sessionProfile.playbookMustCheck.map((label, index) => ({
      id: `playbook:${index}`,
      label,
      source: "playbook" as const
    }))
  ].filter(
    (topic, index, topics) => topics.findIndex((candidate) => candidate.label === topic.label) === index
  );

  const configuredStates = configuredTopics.map((topic) =>
    buildTopicState({
      ...topic,
      evidence: evidenceForTopic(topic.label, input.sessionProfile, input.transcriptWindow)
    })
  );
  const conversationStates = input.transcriptWindow
    .filter((segment) => segment.text.trim().length >= 8)
    .slice(-3)
    .map((segment) =>
      buildTopicState({
        id: `conversation:${segment.sequence}`,
        label: "直近発話の深掘り",
        source: "conversation",
        evidence: [
          {
            speaker: segment.speaker.label,
            text: segment.text
          }
        ]
      })
    );

  return [...conversationStates, ...configuredStates]
    .sort((a, b) => topicPriority(a) - topicPriority(b))
    .slice(0, 12);
}
