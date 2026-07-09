import { buildLocalCoachContext, evaluateLocalRuleGate } from "@/lib/rule-gate";
import {
  COACH_TRANSCRIPT_MAX_FINALS,
  COACH_TRANSCRIPT_MIN_FINALS,
  COACH_TRANSCRIPT_WINDOW_MS,
  buildCoachTopicStates,
  getCoachTranscriptWindow,
  type CoachTopicState
} from "@/lib/coach-topic-state";
import {
  createMissingEnvDiagnostic,
  normalizeProviderError,
  type SafeProviderDiagnostic
} from "@/lib/provider-diagnostics";
import type {
  CoachCard,
  CoachCardCandidate,
  LocalRuleGateResult,
  SessionProfile,
  TranscriptSegment
} from "@/lib/types";

export type LlmProvider = "mock" | "openai" | "anthropic";

export type CoachAdapterInput = {
  sessionProfile: SessionProfile;
  transcriptSegments: TranscriptSegment[];
  existingCards: CoachCard[];
  lastLlmCallAt?: number;
  manualRecheck?: boolean;
};

export type CoachAdapterOptions = {
  apiKey?: string;
  model?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

export type CoachAdapterResult = {
  provider: LlmProvider;
  gate: LocalRuleGateResult;
  candidates: CoachCardCandidate[];
  diagnostic?: SafeProviderDiagnostic;
  payloadPreview?: CoachLlmPayload;
};

export type CoachAdapter = {
  name: LlmProvider;
  generateCards(input: CoachAdapterInput, options?: CoachAdapterOptions): Promise<CoachAdapterResult>;
};

export type CoachLlmPayload = {
  schemaVersion: "rqc.coach.v1";
  task: "generate_question_cards";
  reviewMode: "local_signal" | "transcript_window" | "manual_recheck";
  transcriptWindow: {
    targetDurationMs: number;
    minFinalSegments: number;
    maxFinalSegments: number;
    includedFinalSegments: number;
  };
  session: {
    conversationType: string;
    industry: string;
    purpose: string;
    mustCheckItems: string[];
    playbookMustCheck: string[];
    importantTerms: string[];
    ambiguousTerms: string[];
  };
  recentTranscript: Array<{
    speaker: string;
    text: string;
  }>;
  latestFinalTranscript: {
    speaker: string;
    text: string;
  } | null;
  unconfirmedIssues: string[];
  topicStates: CoachTopicState[];
  triggerReasons: string[];
  localCandidateSeeds: Array<{
    title: string;
    question: string;
    reason: string;
    priority: string;
    score: number;
    ruleIds: string[];
  }>;
  duplicatePrevention: {
    coveredTopics: string[];
    activeQuestions: string[];
    askedDeepDiveDimensions: string[];
  };
  maxCandidates: 3;
};

const COACH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "stableKey",
          "title",
          "question",
          "reason",
          "priority",
          "score",
          "ruleIds",
          "topicId",
          "targetDimension"
        ],
        properties: {
          stableKey: { type: "string" },
          title: { type: "string" },
          question: { type: "string" },
          reason: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          score: { type: "number" },
          ruleIds: { type: "array", items: { type: "string" } },
          topicId: { type: "string" },
          targetDimension: {
            type: "string",
            enum: ["who", "why", "when", "conditions", "examples", "exceptions"]
          }
        }
      }
    }
  }
} as const;

const COACH_SYSTEM_PROMPT = [
  "Return only schema-valid Japanese question card candidates. Do not include meeting minutes.",
  "Generate useful deep-dive questions even when the transcript contains no predefined important or ambiguous keyword.",
  "Ground every candidate in recentTranscript, topicStates.evidence, or latestFinalTranscript and the session purpose.",
  "topicStates are provisional heuristic state: verify them against the transcript before deciding what is missing.",
  "Prioritize partial conversation topics and ask about one missing dimension: who, why, when, conditions, examples, or exceptions.",
  "Use already-covered dimensions and evidence so the next question advances the discussion instead of restarting it.",
  "Treat localCandidateSeeds and unconfirmedIssues as hints, not mandatory questions. Do not ask a not_started checklist topic unless the transcript supports it or it is critical to the session purpose.",
  "Do not repeat duplicatePrevention.activeQuestions or duplicatePrevention.askedDeepDiveDimensions.",
  "duplicatePrevention.coveredTopics are topics already raised: you may ask a different missing dimension on the same topic, but do not restart it from the beginning.",
  "For transcript_window or manual_recheck reviewMode, inspect the whole recent window even when localCandidateSeeds is empty.",
  "Avoid a generic purpose-connection question when a concrete statement can be deepened.",
  "For each candidate, set topicId to a topicStates id, set targetDimension to one missing dimension, and include matching topic:<topic id> and deep-dive:<dimension> values in ruleIds.",
  "Keep every title, question, and reason concise so the full structured response can be returned quickly.",
  "When one or more meaningful missing dimensions exist, return one to three candidates ordered by urgency.",
  "If the transcript does not support a useful follow-up, return an empty candidates array instead of inventing a checklist question.",
  "If the latest transcript is weakly related to the session purpose, return at most one bridge question."
].join(" ");

export const DEFAULT_COACH_LLM_TIMEOUT_MS = 15_000;
export const OPENAI_COACH_MAX_OUTPUT_TOKENS = 1_200;
const MAX_DUPLICATE_PREVENTION_QUESTIONS = 16;

export function getOpenAiCoachReasoning(
  model: string | undefined
): { effort: "minimal" | "none" } | undefined {
  const normalized = model?.trim().toLowerCase();
  if (!normalized || /-pro(?:-|$)/.test(normalized)) return undefined;

  if (/^gpt-5(?:$|-mini(?:-|$)|-nano(?:-|$)|-\d{4})/.test(normalized)) {
    return { effort: "minimal" };
  }
  if (/^gpt-5\.[1-9](?:$|-)/.test(normalized)) {
    return { effort: "none" };
  }

  return undefined;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

function redactInlineSecrets(value: string): string {
  return value
    .replace(/sk-(?:proj-)?[a-zA-Z0-9_-]{8,}/g, "[REDACTED]")
    .replace(/\bBearer\s+[a-zA-Z0-9._~+/=-]{10,}/gi, "[REDACTED]")
    .replace(
      /\b(?:api[_-]?key|token|password|passwd|secret|client_secret)\s*[:=]\s*["']?[^"'\s,;]{6,}/gi,
      "[REDACTED]"
    )
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED]")
    .replace(/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, "[REDACTED]")
    .replace(/\b[a-zA-Z0-9_-]{48,}\b/g, "[REDACTED]");
}

function questionLooksSafe(question: string): boolean {
  const trimmed = question.trim();
  return trimmed.endsWith("？") || trimmed.endsWith("?") || trimmed.endsWith("か");
}

function displayCardQuestions(cards: CoachCard[]): string[] {
  return cards
    .filter((card) => card.status === "active" || card.status === "pinned")
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_DUPLICATE_PREVENTION_QUESTIONS)
    .map((card) => redactInlineSecrets(card.question));
}

function collectCoveredTopics(sessionProfile: SessionProfile, cards: CoachCard[]): string[] {
  const searchableTerms = [
    ...sessionProfile.mustCheckItems,
    ...sessionProfile.playbookMustCheck,
    ...sessionProfile.importantTerms,
    ...sessionProfile.ambiguousTerms
  ];
  const cardText = cards
    .map((card) => `${card.title}\n${card.question}\n${card.reason}`)
    .join("\n");

  return [...new Set(searchableTerms)]
    .filter((term) => term.length > 0 && cardText.includes(term))
    .map(redactInlineSecrets)
    .slice(0, 16);
}

function candidateTouchesCoveredTopic(
  candidate: CoachCardCandidate,
  coveredTopics: string[]
): boolean {
  const candidateText = `${candidate.title}\n${candidate.question}\n${candidate.reason}`;
  return coveredTopics.some((topic) => topic.length > 0 && candidateText.includes(topic));
}

function deepDiveSignature(input: {
  ruleIds: string[];
  topicId?: string;
  targetDimension?: string;
}): string | null {
  const topic = input.topicId ? `topic:${input.topicId}` : input.ruleIds.find((ruleId) => ruleId.startsWith("topic:"));
  const dimension = input.targetDimension
    ? `deep-dive:${input.targetDimension}`
    : input.ruleIds.find((ruleId) => ruleId.startsWith("deep-dive:"));
  return topic && dimension ? `${topic}|${dimension}` : null;
}

function collectAskedDeepDiveDimensions(cards: CoachCard[]): string[] {
  return [
    ...new Set(
      cards
        .map((card) => deepDiveSignature(card))
        .filter((signature): signature is string => Boolean(signature))
    )
  ].slice(0, 16);
}

function removeDuplicateTopicCandidates(
  candidates: CoachCardCandidate[],
  sessionProfile: SessionProfile,
  existingCards: CoachCard[]
): CoachCardCandidate[] {
  const coveredTopics = collectCoveredTopics(sessionProfile, existingCards);
  const activeQuestions = new Set(displayCardQuestions(existingCards));
  const askedDeepDiveDimensions = new Set(collectAskedDeepDiveDimensions(existingCards));

  return candidates.filter((candidate) => {
    if (activeQuestions.has(candidate.question)) return false;

    const signature = deepDiveSignature(candidate);
    if (signature) {
      return !askedDeepDiveDimensions.has(signature);
    }

    return !candidateTouchesCoveredTopic(candidate, coveredTopics);
  });
}

export function buildCoachLlmPayload(
  input: CoachAdapterInput,
  dispatchReasons: string[] = []
): CoachLlmPayload {
  const recentTranscript = getCoachTranscriptWindow(input.transcriptSegments);
  const context = buildLocalCoachContext({
    sessionProfile: input.sessionProfile,
    finalSegments: input.transcriptSegments.filter((segment) => segment.isFinal),
    existingCards: input.existingCards
  });
  const topicStates = buildCoachTopicStates({
    sessionProfile: input.sessionProfile,
    transcriptWindow: recentTranscript,
    transcriptHistory: input.transcriptSegments
  });
  const activeQuestions = displayCardQuestions(input.existingCards);
  const triggerReasons = [
    ...dispatchReasons,
    ...context.candidateSeeds.flatMap((candidate) => candidate.ruleIds)
  ];
  const reviewMode = input.manualRecheck
    ? "manual_recheck"
    : triggerReasons.some((reason) =>
        ["initial_transcript_review", "transcript_window_review"].includes(reason)
      )
      ? "transcript_window"
      : "local_signal";

  return {
    schemaVersion: "rqc.coach.v1",
    task: "generate_question_cards",
    reviewMode,
    transcriptWindow: {
      targetDurationMs: COACH_TRANSCRIPT_WINDOW_MS,
      minFinalSegments: COACH_TRANSCRIPT_MIN_FINALS,
      maxFinalSegments: COACH_TRANSCRIPT_MAX_FINALS,
      includedFinalSegments: recentTranscript.length
    },
    session: {
      conversationType: input.sessionProfile.conversationType,
      industry: input.sessionProfile.industry,
      purpose: redactInlineSecrets(input.sessionProfile.purpose),
      mustCheckItems: input.sessionProfile.mustCheckItems.slice(0, 8).map(redactInlineSecrets),
      playbookMustCheck: input.sessionProfile.playbookMustCheck.slice(0, 8).map(redactInlineSecrets),
      importantTerms: input.sessionProfile.importantTerms.slice(0, 24).map(redactInlineSecrets),
      ambiguousTerms: input.sessionProfile.ambiguousTerms.slice(0, 16).map(redactInlineSecrets)
    },
    recentTranscript: recentTranscript.map((segment) => ({
      speaker: segment.speaker.label,
      text: redactInlineSecrets(segment.text)
    })),
    latestFinalTranscript: context.latestFinal
      ? {
          speaker: context.latestFinal.speaker.label,
          text: redactInlineSecrets(context.latestFinal.text)
        }
      : null,
    unconfirmedIssues: context.unconfirmedIssues.slice(0, 8).map(redactInlineSecrets),
    topicStates: topicStates.map((topic) => ({
      ...topic,
      label: redactInlineSecrets(topic.label),
      evidence: topic.evidence.map((evidence) => ({
        speaker: redactInlineSecrets(evidence.speaker),
        text: redactInlineSecrets(evidence.text).slice(0, 180)
      }))
    })),
    triggerReasons: [...new Set(triggerReasons)].slice(0, 6),
    localCandidateSeeds: context.candidateSeeds.slice(0, 3).map((candidate) => ({
      title: redactInlineSecrets(candidate.title),
      question: redactInlineSecrets(candidate.question),
      reason: redactInlineSecrets(candidate.reason),
      priority: candidate.priority,
      score: candidate.score,
      ruleIds: candidate.ruleIds.slice(0, 4)
    })),
    duplicatePrevention: {
      coveredTopics: collectCoveredTopics(input.sessionProfile, input.existingCards),
      activeQuestions,
      askedDeepDiveDimensions: collectAskedDeepDiveDimensions(input.existingCards)
    },
    maxCandidates: 3
  };
}

export function validateCoachCandidates(candidates: CoachCardCandidate[]): CoachCardCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      title: stripTags(candidate.title).slice(0, 80),
      question: stripTags(candidate.question).slice(0, 160),
      reason: stripTags(candidate.reason).slice(0, 220),
      score: Math.max(0, Math.min(100, Math.round(candidate.score))),
      sourceSegmentIds: candidate.sourceSegmentIds.slice(0, 3),
      ruleIds: candidate.ruleIds.slice(0, 4)
    }))
    .filter((candidate) => questionLooksSafe(candidate.question))
    .filter((candidate) => candidate.score >= 50)
    .slice(0, 3);
}

function candidateFromUnknown(value: unknown, sourceSegmentIds: string[]): CoachCardCandidate | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const priority = source.priority === "high" || source.priority === "low" ? source.priority : "medium";
  const targetDimension =
    source.targetDimension === "who" ||
    source.targetDimension === "why" ||
    source.targetDimension === "when" ||
    source.targetDimension === "conditions" ||
    source.targetDimension === "examples" ||
    source.targetDimension === "exceptions"
      ? source.targetDimension
      : null;

  if (
    typeof source.stableKey !== "string" ||
    typeof source.title !== "string" ||
    typeof source.question !== "string" ||
    typeof source.reason !== "string" ||
    typeof source.score !== "number" ||
    !Array.isArray(source.ruleIds) ||
    typeof source.topicId !== "string" ||
    !targetDimension
  ) {
    return null;
  }

  return {
    stableKey: source.stableKey,
    title: source.title,
    question: source.question,
    reason: source.reason,
    priority,
    score: source.score,
    sourceSegmentIds,
    ruleIds: [
      ...new Set([
        ...source.ruleIds.filter((item): item is string => typeof item === "string"),
        `topic:${source.topicId}`,
        `deep-dive:${targetDimension}`
      ])
    ],
    topicId: source.topicId,
    targetDimension
  };
}

function parseJsonText(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function collectOpenAiResponseTexts(value: unknown): string[] {
  const root = readRecord(value);
  if (!root) return [];

  const texts: string[] = [];
  if (typeof root.output_text === "string") {
    texts.push(root.output_text);
  }

  if (!Array.isArray(root.output)) {
    return texts;
  }

  root.output.forEach((outputItem) => {
    const item = readRecord(outputItem);
    if (!item) return;

    if (typeof item.text === "string") {
      texts.push(item.text);
    }

    if (!Array.isArray(item.content)) {
      return;
    }

    item.content.forEach((contentItem) => {
      const content = readRecord(contentItem);
      if (!content) return;

      if (typeof content.text === "string") {
        texts.push(content.text);
      }
      if (typeof content.output_text === "string") {
        texts.push(content.output_text);
      }
    });
  });

  return texts;
}

function candidatesFromParsedJson(value: unknown): unknown[] | null {
  const parsed = readRecord(value);
  return Array.isArray(parsed?.candidates) ? parsed.candidates : null;
}

export function parseCoachProviderResponse(
  value: unknown,
  sourceSegmentIds: string[]
): CoachCardCandidate[] {
  const root = value as Record<string, unknown>;
  const direct = Array.isArray(root?.candidates) ? root.candidates : null;
  const openAiCandidates =
    collectOpenAiResponseTexts(value)
      .map(parseJsonText)
      .map(candidatesFromParsedJson)
      .find((candidates): candidates is unknown[] => Array.isArray(candidates)) ?? null;
  const anthropicText = Array.isArray(root?.content)
    ? parseJsonText(
        root.content
          .map((item) =>
            item && typeof item === "object" && "text" in item
              ? (item as { text?: string }).text
              : ""
          )
          .join("")
      )
    : null;
  const anthropicToolInput = Array.isArray(root?.content)
    ? root.content.find(
        (item) => item && typeof item === "object" && (item as { type?: string }).type === "tool_use"
      )
    : null;
  const candidates =
    direct ??
    openAiCandidates ??
    ((anthropicText as { candidates?: unknown[] } | null)?.candidates ?? null) ??
    ((anthropicToolInput as { input?: { candidates?: unknown[] } } | null)?.input?.candidates ?? null);

  if (!Array.isArray(candidates)) return [];

  return validateCoachCandidates(
    candidates
      .map((candidate) => candidateFromUnknown(candidate, sourceSegmentIds))
      .filter((candidate): candidate is CoachCardCandidate => Boolean(candidate))
  );
}

function coachCandidateEnvelope(value: unknown): unknown[] | null {
  const root = readRecord(value);
  if (!root) return null;
  if (Array.isArray(root.candidates)) return root.candidates;

  const openAiCandidates = collectOpenAiResponseTexts(value)
    .map(parseJsonText)
    .map(candidatesFromParsedJson)
    .find((candidates): candidates is unknown[] => Array.isArray(candidates));
  if (openAiCandidates) return openAiCandidates;

  if (!Array.isArray(root.content)) return null;
  const anthropicText = parseJsonText(
    root.content
      .map((item) => {
        const content = readRecord(item);
        return typeof content?.text === "string" ? content.text : "";
      })
      .join("")
  );
  const anthropicTextCandidates = candidatesFromParsedJson(anthropicText);
  if (anthropicTextCandidates) return anthropicTextCandidates;

  const toolUse = root.content
    .map(readRecord)
    .find((item) => item?.type === "tool_use");
  const toolInput = readRecord(toolUse?.input);
  return Array.isArray(toolInput?.candidates) ? toolInput.candidates : null;
}

export const mockCoachAdapter: CoachAdapter = {
  name: "mock",
  async generateCards(input) {
    const gate = evaluateLocalRuleGate({
      sessionProfile: input.sessionProfile,
      finalSegments: input.transcriptSegments.filter((segment) => segment.isFinal),
      existingCards: input.existingCards,
      lastLlmCallAt: input.lastLlmCallAt,
      manualRecheck: input.manualRecheck
    });

    return {
      provider: "mock",
      gate,
      candidates: gate.shouldCallLlm ? validateCoachCandidates(gate.candidateSeeds) : [],
      payloadPreview: buildCoachLlmPayload(input, gate.reasons)
    };
  }
};

function providerTimeoutSignal(timeoutMs: number | undefined): AbortSignal {
  return AbortSignal.timeout(timeoutMs ?? DEFAULT_COACH_LLM_TIMEOUT_MS);
}

async function callOpenAiCoach(
  input: CoachAdapterInput,
  options: CoachAdapterOptions,
  dispatchReasons: string[]
) {
  const fetcher = options.fetcher ?? fetch;
  const payload = buildCoachLlmPayload(input, dispatchReasons);
  const reasoning = getOpenAiCoachReasoning(options.model);
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json"
    },
    signal: providerTimeoutSignal(options.timeoutMs),
    body: JSON.stringify({
      model: options.model,
      max_output_tokens: OPENAI_COACH_MAX_OUTPUT_TOKENS,
      ...(reasoning ? { reasoning } : {}),
      input: [
        {
          role: "system",
          content: COACH_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: JSON.stringify(payload)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "rqc_coach_cards",
          strict: true,
          schema: COACH_JSON_SCHEMA
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI coach request failed: ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

async function callAnthropicCoach(
  input: CoachAdapterInput,
  options: CoachAdapterOptions,
  dispatchReasons: string[]
) {
  const fetcher = options.fetcher ?? fetch;
  const payload = buildCoachLlmPayload(input, dispatchReasons);
  const response = await fetcher("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": options.apiKey ?? "",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    signal: providerTimeoutSignal(options.timeoutMs),
    body: JSON.stringify({
      model: options.model,
      max_tokens: 800,
      system: COACH_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify(payload)
        }
      ],
      tools: [
        {
          name: "emit_coach_cards",
          description: "Emit Realtime Question Coach card candidates.",
          input_schema: COACH_JSON_SCHEMA
        }
      ],
      tool_choice: {
        type: "tool",
        name: "emit_coach_cards"
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic coach request failed: ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

function realCoachAdapter(provider: Exclude<LlmProvider, "mock">): CoachAdapter {
  return {
    name: provider,
    async generateCards(input, options = {}) {
      const gate = evaluateLocalRuleGate({
        sessionProfile: input.sessionProfile,
        finalSegments: input.transcriptSegments.filter((segment) => segment.isFinal),
        existingCards: input.existingCards,
        lastLlmCallAt: input.lastLlmCallAt,
        manualRecheck: input.manualRecheck
      });
      const payloadPreview = buildCoachLlmPayload(input, gate.reasons);
      const localCandidates = gate.shouldCallLlm ? validateCoachCandidates(gate.candidateSeeds) : [];

      if (!gate.shouldCallLlm) {
        return {
          provider,
          gate,
          candidates: [],
          payloadPreview
        };
      }

      if (!options.apiKey || !options.model) {
        return {
          provider,
          gate,
          candidates: [],
          payloadPreview,
          diagnostic: createMissingEnvDiagnostic({
            category: "llm",
            provider,
            envNames: [provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY", "LLM_MODEL_REALTIME"]
          })
        };
      }

      try {
        const sourceSegmentIds = getCoachTranscriptWindow(input.transcriptSegments)
          .slice(-3)
          .map((segment) => segment.id);
        const raw =
          provider === "openai"
            ? await callOpenAiCoach(input, options, gate.reasons)
            : await callAnthropicCoach(input, options, gate.reasons);
        const envelope = coachCandidateEnvelope(raw);
        const providerCandidates = parseCoachProviderResponse(raw, sourceSegmentIds);

        if (!envelope || (envelope.length > 0 && providerCandidates.length === 0)) {
          return {
            provider,
            gate,
            candidates: localCandidates,
            payloadPreview,
            diagnostic: {
              code: "schema_mismatch",
              category: "llm",
              provider,
              message: "LLM coach response did not match the expected card candidate schema.",
              retryable: false,
              severity: "error"
            }
          };
        }

        const candidates = removeDuplicateTopicCandidates(
          providerCandidates,
          input.sessionProfile,
          input.existingCards
        );

        if (candidates.length === 0) {
          return {
            provider,
            gate,
            candidates: localCandidates,
            payloadPreview
          };
        }

        return {
          provider,
          gate,
          candidates,
          payloadPreview
        };
      } catch (error) {
        return {
          provider,
          gate,
          candidates: localCandidates,
          payloadPreview,
          diagnostic: normalizeProviderError(error, {
            category: "llm",
            provider
          })
        };
      }
    }
  };
}

export function getCoachAdapter(provider: LlmProvider = "mock"): CoachAdapter {
  if (provider === "openai" || provider === "anthropic") return realCoachAdapter(provider);
  return mockCoachAdapter;
}
