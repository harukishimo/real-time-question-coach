import { NextRequest } from "next/server";
import { canUseCoachApi, requireApiUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { applyCoachCardCandidates } from "@/lib/coach-card";
import { getServerRuntimeConfig } from "@/lib/env";
import { getCoachAdapter, validateCoachCandidates } from "@/lib/llm-adapter";
import { providerRateLimiter } from "@/lib/security";
import type { CoachCard, SessionProfile, TranscriptSegment } from "@/lib/types";

type CoachPayload = {
  sessionProfile: SessionProfile;
  transcriptSegments: TranscriptSegment[];
  existingCards?: CoachCard[];
  lastLlmCallAt?: number;
  manualRecheck?: boolean;
};

function isCoachPayload(value: unknown): value is CoachPayload {
  if (!value || typeof value !== "object") return false;
  const source = value as CoachPayload;
  return Boolean(source.sessionProfile?.id) && Array.isArray(source.transcriptSegments);
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
    return jsonError("forbidden", "This user cannot use coach APIs.", 403);
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  if (!isCoachPayload(payload)) {
    return jsonError("invalid_coach_payload", "sessionProfile and transcriptSegments are required.", 422);
  }

  const rateLimit = providerRateLimiter.check({
    route: "coach",
    userId: auth.user.id,
    sessionId: payload.sessionProfile.id,
    forwardedFor: request.headers.get("x-forwarded-for")
  });
  if (!rateLimit.ok) {
    return jsonError("rate_limited", "Coach provider requests are temporarily rate limited.", 429);
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
  const missingLlmEnv = config.missingRequiredServerKeys.filter((key) =>
    ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "LLM_MODEL_REALTIME"].includes(key)
  );
  const invalidLlmConfig = config.diagnostics.find(
    (diagnostic) => diagnostic.category === "llm" && diagnostic.code === "invalid_config"
  );
  if (invalidLlmConfig) {
    return jsonError(invalidLlmConfig.code, invalidLlmConfig.message, 422, invalidLlmConfig);
  }
  if (config.llmProvider !== "mock" && missingLlmEnv.length > 0) {
    return jsonError(
      "missing_env",
      `${config.llmProvider} coach provider is selected but required env is missing: ${missingLlmEnv.join(", ")}`,
      422
    );
  }

  const adapter = getCoachAdapter(config.llmProvider);
  const existingCards = payload.existingCards ?? [];
  const result = await adapter.generateCards(
    {
      sessionProfile: payload.sessionProfile,
      transcriptSegments: payload.transcriptSegments,
      existingCards,
      lastLlmCallAt: payload.lastLlmCallAt,
      manualRecheck: payload.manualRecheck
    },
    {
      apiKey: llmApiKey(config.llmProvider),
      model: config.realtimeModel
    }
  );
  const candidates = validateCoachCandidates(result.candidates);
  if (result.diagnostic && config.llmProvider !== "mock" && candidates.length === 0) {
    return jsonError(result.diagnostic.code, result.diagnostic.message, 422, result.diagnostic);
  }
  const cards = applyCoachCardCandidates(existingCards, candidates);

  return jsonOk({
    provider: result.provider,
    gate: result.gate,
    candidates,
    cards,
    diagnostic: result.diagnostic,
    storagePolicy: {
      persistedToServer: false,
      bodyLogged: false
    }
  });
}
