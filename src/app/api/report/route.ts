import { NextRequest } from "next/server";
import { canUseCoachApi, requireApiUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getServerRuntimeConfig } from "@/lib/env";
import { generateSessionReportWithProvider } from "@/lib/report-adapter";
import { providerRateLimiter } from "@/lib/security";
import type { CoachCard, SessionProfile, TranscriptSegment } from "@/lib/types";

type ReportPayload = {
  sessionProfile: SessionProfile;
  transcriptSegments: TranscriptSegment[];
  cards: CoachCard[];
};

function isReportPayload(value: unknown): value is ReportPayload {
  if (!value || typeof value !== "object") return false;
  const source = value as ReportPayload;
  return Boolean(source.sessionProfile?.id) && Array.isArray(source.transcriptSegments) && Array.isArray(source.cards);
}

function llmApiKey(provider: "mock" | "openai" | "anthropic"): string | undefined {
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY;
  return undefined;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request.headers);
  if (!auth.ok) {
    return jsonError(auth.code, auth.message, auth.status);
  }
  if (!canUseCoachApi(auth.user)) {
    return jsonError("forbidden", "This user cannot use report APIs.", 403);
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  if (!isReportPayload(payload)) {
    return jsonError("invalid_report_payload", "sessionProfile, transcriptSegments and cards are required.", 422);
  }

  const rateLimit = providerRateLimiter.check({
    route: "report",
    userId: auth.user.id,
    sessionId: payload.sessionProfile.id,
    forwardedFor: request.headers.get("x-forwarded-for")
  });
  if (!rateLimit.ok) {
    return jsonError("rate_limited", "Report provider requests are temporarily rate limited.", 429);
  }

  const config = getServerRuntimeConfig();
  if (config.providerMode === "real" && !config.providerReady) {
    const diagnostic = config.diagnostics.find((item) => item.severity === "error");
    return jsonError(
      diagnostic?.code ?? "invalid_config",
      diagnostic?.message ?? "Real provider mode is not ready.",
      422,
      diagnostic
    );
  }
  const missingReportEnv = config.missingRequiredServerKeys.filter((key) =>
    ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "LLM_MODEL_REPORT"].includes(key)
  );
  const invalidLlmConfig = config.diagnostics.find(
    (diagnostic) => diagnostic.category === "llm" && diagnostic.code === "invalid_config"
  );
  if (invalidLlmConfig) {
    return jsonError(invalidLlmConfig.code, invalidLlmConfig.message, 422, invalidLlmConfig);
  }
  if (config.llmProvider !== "mock" && missingReportEnv.length > 0) {
    return jsonError(
      "missing_env",
      `${config.llmProvider} report provider is selected but required env is missing: ${missingReportEnv.join(", ")}`,
      422
    );
  }

  const result = await generateSessionReportWithProvider(config.llmProvider, payload, {
    apiKey: llmApiKey(config.llmProvider),
    model: config.reportModel
  });

  if (!result.ok && config.llmProvider !== "mock") {
    return jsonError(result.diagnostic.code, result.diagnostic.message, 422, result.diagnostic);
  }

  return jsonOk({
    report: result.ok ? result.report : result.fallbackReport,
    provider: result.provider,
    diagnostic: result.ok ? undefined : result.diagnostic,
    storagePolicy: {
      persistedToServer: false,
      bodyLogged: false
    }
  });
}
