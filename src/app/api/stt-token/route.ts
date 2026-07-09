import { NextRequest } from "next/server";
import { canUseCoachApi, requireApiUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getServerRuntimeConfig } from "@/lib/env";
import { isAudioSourceType } from "@/lib/session-profile";
import { providerRateLimiter } from "@/lib/security";
import { getSttAdapter } from "@/lib/stt";

function hasAudioBody(value: Record<string, unknown>): boolean {
  return ["audio", "audioBytes", "blob", "file", "url", "remoteUrl"].some((key) => key in value);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request.headers);
  if (!auth.ok) {
    return jsonError(auth.code, auth.message, auth.status);
  }
  if (!canUseCoachApi(auth.user)) {
    return jsonError("forbidden", "This user cannot use STT APIs.", 403);
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object") {
    return jsonError("invalid_stt_payload", "audioSource and sessionId are required.", 422);
  }

  const source = body as Record<string, unknown>;
  if (hasAudioBody(source)) {
    return jsonError("audio_body_not_allowed", "Audio bytes or remote audio URLs must not be sent to this API.", 422);
  }

  const audioSource = source.audioSource;
  const sessionId = typeof source.sessionId === "string" ? source.sessionId : "";

  if (!isAudioSourceType(audioSource)) {
    return jsonError("invalid_audio_source", "A supported audioSource is required.", 422);
  }
  if (sessionId.length < 8) {
    return jsonError("invalid_session_id", "A sessionId is required for STT token binding.", 422);
  }

  const rateLimit = providerRateLimiter.check({
    route: "stt-token",
    userId: auth.user.id,
    sessionId,
    forwardedFor: request.headers.get("x-forwarded-for")
  });
  if (!rateLimit.ok) {
    return jsonError("rate_limited", "STT token requests are temporarily rate limited.", 429);
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
  const missingSttEnv = config.missingRequiredServerKeys.filter((key) => key === "STT_API_KEY");
  const invalidSttConfig = config.diagnostics.find(
    (diagnostic) => diagnostic.category === "stt" && diagnostic.code === "invalid_config"
  );
  if (invalidSttConfig) {
    return jsonError(invalidSttConfig.code, invalidSttConfig.message, 422, invalidSttConfig);
  }
  if (config.sttProvider !== "mock" && missingSttEnv.length > 0) {
    return jsonError("missing_env", "OpenAI STT is selected but STT_API_KEY is missing.", 422);
  }

  const adapter = getSttAdapter(config.sttProvider);
  const result = await adapter.createToken({
    audioSource,
    sessionId,
    user: auth.user,
    apiKey: process.env.STT_API_KEY
  });

  if (!result.ok) {
    return jsonError(result.diagnostic.code, result.diagnostic.message, 422, result.diagnostic);
  }

  return jsonOk({
    stt: result.stt,
    storagePolicy: {
      audioStoredByApplication: false,
      longRunningRelayViaNextApi: false,
      bodyLogged: false
    }
  });
}
