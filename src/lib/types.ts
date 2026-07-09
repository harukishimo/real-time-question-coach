export type ConversationType =
  | "sales"
  | "requirements"
  | "recruiting"
  | "user_research";

export type Industry = "manufacturing" | "it" | "healthcare" | "finance" | "generic";

export type AudioSourceType = "microphone" | "browser_tab" | "system_audio" | "dummy";

export type UserRole = "owner" | "user" | "dev_mock_user";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  provider: "google" | "dev_mock";
};

export type SessionSetupInput = {
  conversationType: ConversationType;
  industry: Industry;
  purpose: string;
  mustCheckItems: string[];
  audioSource: AudioSourceType;
  consentNoServerStorage: boolean;
};

export type SessionProfile = {
  id: string;
  conversationType: ConversationType;
  industry: Industry;
  purpose: string;
  mustCheckItems: string[];
  audioSource: AudioSourceType;
  knowledgeSetId: string;
  playbookTitle: string;
  playbookDescription: string;
  playbookMustCheck: string[];
  importantTerms: string[];
  ambiguousTerms: string[];
  mustAskTemplates: string[];
  avoidQuestions: string[];
  completionCriteria: string[];
  cardRules: string[];
  createdAt: string;
};

export type SpeakerInfo = {
  id: "user" | "participant" | "unknown";
  label: string;
  source: "fixture" | "provider" | "unknown";
  confidence: number;
};

export type TranscriptSegment = {
  id: string;
  sequence: number;
  speaker: SpeakerInfo;
  text: string;
  isFinal: boolean;
  startedAtMs: number;
  endedAtMs?: number;
  createdAt: string;
};

export type CoachCardStatus =
  | "active"
  | "queued"
  | "later"
  | "done"
  | "dismissed"
  | "pinned";

export type CoachCardPriority = "high" | "medium" | "low";

export type CoachDeepDiveDimension =
  | "who"
  | "why"
  | "when"
  | "conditions"
  | "examples"
  | "exceptions";

export type CoachCard = {
  id: string;
  title: string;
  question: string;
  reason: string;
  priority: CoachCardPriority;
  score: number;
  status: CoachCardStatus;
  sourceSegmentIds: string[];
  ruleIds: string[];
  topicId?: string;
  targetDimension?: CoachDeepDiveDimension;
  createdAt: string;
};

export type CoachCardCandidate = Omit<CoachCard, "id" | "status" | "createdAt"> & {
  stableKey: string;
};

export type LocalRuleGateResult = {
  shouldCallLlm: boolean;
  reasons: string[];
  candidateSeeds: CoachCardCandidate[];
  nextAllowedAt: number;
};

export type SessionReport = {
  sessionId: string;
  heardItems: string[];
  missedItems: string[];
  nextActions: string[];
  cardStats: {
    total: number;
    done: number;
    later: number;
    dismissed: number;
  };
  generatedAt: string;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};
