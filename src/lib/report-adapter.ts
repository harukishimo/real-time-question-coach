import { buildSessionReport } from "@/lib/report";
import {
  createMissingEnvDiagnostic,
  normalizeProviderError,
  type SafeProviderDiagnostic
} from "@/lib/provider-diagnostics";
import type { CoachCard, SessionProfile, SessionReport, TranscriptSegment } from "@/lib/types";

export type ReportProvider = "mock" | "openai" | "anthropic";

export type ReportAdapterInput = {
  sessionProfile: SessionProfile;
  transcriptSegments: TranscriptSegment[];
  cards: CoachCard[];
};

export type ReportLlmPayload = {
  schemaVersion: "rqc.report.v1";
  task: "generate_session_report";
  session: {
    conversationType: string;
    industry: string;
    purpose: string;
    mustCheckItems: string[];
  };
  transcriptSummaryInput: Array<{
    speaker: string;
    text: string;
  }>;
  cards: Array<{
    title: string;
    question: string;
    status: string;
  }>;
};

export type ReportAdapterResult =
  | {
      ok: true;
      provider: ReportProvider;
      report: SessionReport;
      payloadPreview: ReportLlmPayload;
    }
  | {
      ok: false;
      provider: ReportProvider;
      diagnostic: SafeProviderDiagnostic;
      fallbackReport: SessionReport;
      payloadPreview: ReportLlmPayload;
    };

const REPORT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["heardItems", "missedItems", "nextActions"],
  properties: {
    heardItems: { type: "array", items: { type: "string" } },
    missedItems: { type: "array", items: { type: "string" } },
    nextActions: { type: "array", items: { type: "string" } }
  }
} as const;

export const DEFAULT_REPORT_LLM_TIMEOUT_MS = 45_000;

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

export function buildReportLlmPayload(input: ReportAdapterInput): ReportLlmPayload {
  return {
    schemaVersion: "rqc.report.v1",
    task: "generate_session_report",
    session: {
      conversationType: input.sessionProfile.conversationType,
      industry: input.sessionProfile.industry,
      purpose: redactInlineSecrets(input.sessionProfile.purpose),
      mustCheckItems: input.sessionProfile.mustCheckItems.slice(0, 8).map(redactInlineSecrets)
    },
    transcriptSummaryInput: input.transcriptSegments
      .filter((segment) => segment.isFinal)
      .slice(-12)
      .map((segment) => ({
        speaker: segment.speaker.label,
        text: redactInlineSecrets(segment.text)
      })),
    cards: input.cards.slice(-20).map((card) => ({
      title: redactInlineSecrets(card.title),
      question: redactInlineSecrets(card.question),
      status: card.status
    }))
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

function isReportShape(value: unknown): value is Record<string, unknown> {
  const candidate = readRecord(value);
  return Boolean(
    candidate &&
      Array.isArray(candidate.heardItems) &&
      Array.isArray(candidate.missedItems) &&
      Array.isArray(candidate.nextActions)
  );
}

export function parseReportProviderResponse(
  value: unknown,
  fallback: SessionReport
): SessionReport | null {
  const root = value as Record<string, unknown>;
  const openAiReport =
    collectOpenAiResponseTexts(value)
      .map(parseJsonText)
      .find(isReportShape) ?? null;
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
  const direct = isReportShape(root) ? root : null;
  const candidate = (direct ?? openAiReport ?? anthropicText) as Record<string, unknown> | null;

  if (
    !candidate ||
    !Array.isArray(candidate.heardItems) ||
    !Array.isArray(candidate.missedItems) ||
    !Array.isArray(candidate.nextActions)
  ) {
    return null;
  }

  return {
    ...fallback,
    heardItems: candidate.heardItems.filter((item): item is string => typeof item === "string").slice(0, 8),
    missedItems: candidate.missedItems.filter((item): item is string => typeof item === "string").slice(0, 8),
    nextActions: candidate.nextActions.filter((item): item is string => typeof item === "string").slice(0, 8),
    generatedAt: new Date().toISOString()
  };
}

async function callOpenAiReport(
  input: ReportAdapterInput,
  options: { apiKey: string; model: string; fetcher: typeof fetch; timeoutMs?: number }
) {
  const payload = buildReportLlmPayload(input);
  const response = await options.fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_REPORT_LLM_TIMEOUT_MS),
    body: JSON.stringify({
      model: options.model,
      input: [
        {
          role: "system",
          content:
            "Return only schema-valid Japanese session report fields for missed questions and next actions."
        },
        {
          role: "user",
          content: JSON.stringify(payload)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "rqc_session_report",
          strict: true,
          schema: REPORT_JSON_SCHEMA
        }
      }
    })
  });

  if (!response.ok) throw new Error(`OpenAI report request failed: ${response.status}`);
  return response.json() as Promise<unknown>;
}

async function callAnthropicReport(
  input: ReportAdapterInput,
  options: { apiKey: string; model: string; fetcher: typeof fetch; timeoutMs?: number }
) {
  const payload = buildReportLlmPayload(input);
  const response = await options.fetcher("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_REPORT_LLM_TIMEOUT_MS),
    body: JSON.stringify({
      model: options.model,
      max_tokens: 1000,
      system: "Return only JSON matching the requested report schema.",
      messages: [
        {
          role: "user",
          content: JSON.stringify(payload)
        }
      ]
    })
  });

  if (!response.ok) throw new Error(`Anthropic report request failed: ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function generateSessionReportWithProvider(
  provider: ReportProvider,
  input: ReportAdapterInput,
  options: {
    apiKey?: string;
    model?: string;
    fetcher?: typeof fetch;
    timeoutMs?: number;
  } = {}
): Promise<ReportAdapterResult> {
  const fallbackReport = buildSessionReport(input);
  const payloadPreview = buildReportLlmPayload(input);

  if (provider === "mock") {
    return {
      ok: true,
      provider,
      report: fallbackReport,
      payloadPreview
    };
  }

  if (!options.apiKey || !options.model) {
    return {
      ok: false,
      provider,
      fallbackReport,
      payloadPreview,
      diagnostic: createMissingEnvDiagnostic({
        category: "report",
        provider,
        envNames: [provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY", "LLM_MODEL_REPORT"]
      })
    };
  }

  try {
    const fetcher = options.fetcher ?? fetch;
    const raw =
      provider === "openai"
        ? await callOpenAiReport(input, {
            apiKey: options.apiKey,
            model: options.model,
            fetcher,
            timeoutMs: options.timeoutMs
          })
        : await callAnthropicReport(input, {
            apiKey: options.apiKey,
            model: options.model,
            fetcher,
            timeoutMs: options.timeoutMs
          });
    const report = parseReportProviderResponse(raw, fallbackReport);

    if (!report) {
      return {
        ok: false,
        provider,
        fallbackReport,
        payloadPreview,
        diagnostic: {
          code: "schema_mismatch",
          category: "report",
          provider,
          message: "LLM report response did not match the expected schema.",
          retryable: false,
          severity: "error"
        }
      };
    }

    return {
      ok: true,
      provider,
      report,
      payloadPreview
    };
  } catch (error) {
    return {
      ok: false,
      provider,
      fallbackReport,
      payloadPreview,
      diagnostic: normalizeProviderError(error, {
        category: "report",
        provider
      })
    };
  }
}
