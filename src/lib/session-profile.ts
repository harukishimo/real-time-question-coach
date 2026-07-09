import { resolveKnowledgeSet } from "@/lib/knowledge";
import type {
  AudioSourceType,
  ConversationType,
  Industry,
  SessionProfile,
  SessionSetupInput
} from "@/lib/types";

const conversationTypes = ["sales", "requirements", "recruiting", "user_research"] as const;
const industries = ["manufacturing", "it", "healthcare", "finance", "generic"] as const;
const audioSources = ["microphone", "browser_tab", "system_audio", "dummy"] as const;

export function isConversationType(value: unknown): value is ConversationType {
  return typeof value === "string" && conversationTypes.includes(value as ConversationType);
}

export function isIndustry(value: unknown): value is Industry {
  return typeof value === "string" && industries.includes(value as Industry);
}

export function isAudioSourceType(value: unknown): value is AudioSourceType {
  return typeof value === "string" && audioSources.includes(value as AudioSourceType);
}

export function normalizeMustCheckItems(input: string | string[]): string[] {
  const items = Array.isArray(input) ? input : input.split(/\n|,/);
  return items.map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

export function validateSessionSetupInput(input: unknown): {
  ok: true;
  value: SessionSetupInput;
} | {
  ok: false;
  errors: string[];
} {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["input must be an object"] };
  }

  const source = input as Record<string, unknown>;
  const errors: string[] = [];

  if (!isConversationType(source.conversationType)) {
    errors.push("conversationType is required");
  }
  if (!isIndustry(source.industry)) {
    errors.push("industry is required");
  }
  if (source.audioSource !== undefined && !isAudioSourceType(source.audioSource)) {
    errors.push("audioSource must be supported when provided");
  }
  if (typeof source.purpose !== "string" || source.purpose.trim().length < 3) {
    errors.push("purpose must be at least 3 characters");
  }
  if (source.consentNoServerStorage === false) {
    errors.push("server conversation storage is not supported");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      conversationType: source.conversationType as ConversationType,
      industry: source.industry as Industry,
      purpose: (source.purpose as string).trim(),
      mustCheckItems: normalizeMustCheckItems(
        Array.isArray(source.mustCheckItems)
          ? source.mustCheckItems.filter((item): item is string => typeof item === "string")
          : ""
      ),
      audioSource: isAudioSourceType(source.audioSource) ? source.audioSource : "dummy",
      consentNoServerStorage: true
    }
  };
}

export function createSessionProfile(input: SessionSetupInput): SessionProfile {
  const knowledgeSet = resolveKnowledgeSet(input.conversationType, input.industry);
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `session-${Date.now()}`;

  return {
    id,
    conversationType: input.conversationType,
    industry: input.industry,
    purpose: input.purpose,
    mustCheckItems: input.mustCheckItems,
    audioSource: input.audioSource,
    knowledgeSetId: knowledgeSet.id,
    playbookTitle: knowledgeSet.title,
    playbookDescription: knowledgeSet.description,
    playbookMustCheck: knowledgeSet.mustCheck,
    importantTerms: [...new Set([...knowledgeSet.importantTerms, ...input.mustCheckItems])],
    ambiguousTerms: knowledgeSet.ambiguousTerms,
    mustAskTemplates: knowledgeSet.mustAskTemplates,
    avoidQuestions: knowledgeSet.avoid,
    completionCriteria: knowledgeSet.completionCriteria,
    cardRules: knowledgeSet.cardRules,
    createdAt: new Date().toISOString()
  };
}

export function getConversationTypeLabel(value: ConversationType): string {
  return {
    sales: "商談",
    requirements: "要件定義",
    recruiting: "採用",
    user_research: "ユーザー調査"
  }[value];
}

export function getIndustryLabel(value: Industry): string {
  return {
    manufacturing: "製造",
    it: "IT",
    healthcare: "医療",
    finance: "金融",
    generic: "汎用"
  }[value];
}

export function getAudioSourceLabel(value: AudioSourceType): string {
  return {
    microphone: "マイク",
    browser_tab: "Webタブ音声",
    system_audio: "システム音声",
    dummy: "ダミー文字起こし"
  }[value];
}
