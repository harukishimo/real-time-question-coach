import { evaluateLocalRuleGate } from "@/lib/rule-gate";
import { getRecentConversationBuffer } from "@/lib/transcript";
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
  existingCardQuestions: string[];
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
        required: ["stableKey", "title", "question", "reason", "priority", "score", "ruleIds"],
        properties: {
          stableKey: { type: "string" },
          title: { type: "string" },
          question: { type: "string" },
          reason: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          score: { type: "number" },
          ruleIds: { type: "array", items: { type: "string" } }
        }
      }
    }
  }
} as const;

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

function redactInlineSecrets(value: string): string {
  return value.replace(/(sk-[a-zA-Z0-9_-]{8,}|Bearer\s+[a-zA-Z0-9._-]+)/g, "[REDACTED]");
}

function questionLooksSafe(question: string): boolean {
  const trimmed = question.trim();
  return trimmed.endsWith("？") || trimmed.endsWith("?") || trimmed.endsWith("か");
}

export function buildCoachLlmPayload(input: CoachAdapterInput): CoachLlmPayload {
  return {
    schemaVersion: "rqc.coach.v1",
    task: "generate_question_cards",
    session: {
      conversationType: input.sessionProfile.conversationType,
      industry: input.sessionProfile.industry,
      purpose: redactInlineSecrets(input.sessionProfile.purpose),
      mustCheckItems: input.sessionProfile.mustCheckItems.slice(0, 8).map(redactInlineSecrets),
      playbookMustCheck: input.sessionProfile.playbookMustCheck.slice(0, 8).map(redactInlineSecrets),
      importantTerms: input.sessionProfile.importantTerms.slice(0, 24).map(redactInlineSecrets),
      ambiguousTerms: input.sessionProfile.ambiguousTerms.slice(0, 16).map(redactInlineSecrets)
    },
    recentTranscript: getRecentConversationBuffer(input.transcriptSegments, 6).map((segment) => ({
      speaker: segment.speaker.label,
      text: redactInlineSecrets(segment.text)
    })),
    existingCardQuestions: input.existingCards.map((card) => redactInlineSecrets(card.question)).slice(-8),
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

  if (
    typeof source.stableKey !== "string" ||
    typeof source.title !== "string" ||
    typeof source.question !== "string" ||
    typeof source.reason !== "string" ||
    typeof source.score !== "number" ||
    !Array.isArray(source.ruleIds)
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
    ruleIds: source.ruleIds.filter((item): item is string => typeof item === "string")
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

export function parseCoachProviderResponse(
  value: unknown,
  sourceSegmentIds: string[]
): CoachCardCandidate[] {
  const root = value as Record<string, unknown>;
  const direct = Array.isArray(root?.candidates) ? root.candidates : null;
  const openAiText = typeof root?.output_text === "string" ? parseJsonText(root.output_text) : null;
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
    ((openAiText as { candidates?: unknown[] } | null)?.candidates ?? null) ??
    ((anthropicText as { candidates?: unknown[] } | null)?.candidates ?? null) ??
    ((anthropicToolInput as { input?: { candidates?: unknown[] } } | null)?.input?.candidates ?? null);

  if (!Array.isArray(candidates)) return [];

  return validateCoachCandidates(
    candidates
      .map((candidate) => candidateFromUnknown(candidate, sourceSegmentIds))
      .filter((candidate): candidate is CoachCardCandidate => Boolean(candidate))
  );
}

export const mockCoachAdapter: CoachAdapter = {
  name: "mock",
  async generateCards(input) {
    const gate = evaluateLocalRuleGate({
      sessionProfile: input.sessionProfile,
      finalSegments: input.transcriptSegments.filter((segment) => segment.isFinal),
      existingCards: input.existingCards,
      lastLlmCallAt: input.manualRecheck ? 0 : input.lastLlmCallAt
    });

    return {
      provider: "mock",
      gate,
      candidates: gate.shouldCallLlm ? validateCoachCandidates(gate.candidateSeeds) : [],
      payloadPreview: buildCoachLlmPayload(input)
    };
  }
};

function providerTimeoutSignal(timeoutMs: number | undefined): AbortSignal {
  return AbortSignal.timeout(timeoutMs ?? 12_000);
}

async function callOpenAiCoach(input: CoachAdapterInput, options: CoachAdapterOptions) {
  const fetcher = options.fetcher ?? fetch;
  const payload = buildCoachLlmPayload(input);
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json"
    },
    signal: providerTimeoutSignal(options.timeoutMs),
    body: JSON.stringify({
      model: options.model,
      input: [
        {
          role: "system",
          content:
            "Return only schema-valid Japanese question card candidates. Do not include meeting minutes."
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

async function callAnthropicCoach(input: CoachAdapterInput, options: CoachAdapterOptions) {
  const fetcher = options.fetcher ?? fetch;
  const payload = buildCoachLlmPayload(input);
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
      system:
        "Return Japanese question card candidates via the provided tool. Do not include meeting minutes.",
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
        lastLlmCallAt: input.manualRecheck ? 0 : input.lastLlmCallAt
      });
      const payloadPreview = buildCoachLlmPayload(input);

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
        const sourceSegmentIds = getRecentConversationBuffer(input.transcriptSegments, 6).map(
          (segment) => segment.id
        );
        const raw =
          provider === "openai"
            ? await callOpenAiCoach(input, options)
            : await callAnthropicCoach(input, options);
        const candidates = parseCoachProviderResponse(raw, sourceSegmentIds);

        if (candidates.length === 0) {
          return {
            provider,
            gate,
            candidates: [],
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
          candidates: [],
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
