import { createDummyTranscriptPair } from "@/lib/dummy-transcript";
import { normalizeProviderError, type SafeProviderDiagnostic } from "@/lib/provider-diagnostics";
import type { AudioSourceType, AuthUser, ConversationType, TranscriptSegment } from "@/lib/types";

const MAX_TOKEN_TTL_SECONDS = 300;
const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export type SttProvider = "mock" | "openai";

export type SttTokenResponse = {
  provider: SttProvider;
  token: string;
  expiresAt: string;
  ttlSeconds: number;
  scope: "transcribe";
  boundUserId: string;
  boundSessionId: string;
  audioSource: AudioSourceType;
  directStreaming: boolean;
  websocketUrl: string | null;
  connectionType: "mock" | "webrtc";
  realtimeUrl: string | null;
};

export type SttTokenResult =
  | {
      ok: true;
      stt: SttTokenResponse;
    }
  | {
      ok: false;
      diagnostic: SafeProviderDiagnostic;
    };

export type SttAdapter = {
  name: SttProvider;
  createToken(input: {
    audioSource: AudioSourceType;
    sessionId: string;
    user: AuthUser;
    apiKey?: string;
    fetcher?: typeof fetch;
    now?: number;
    timeoutMs?: number;
  }): Promise<SttTokenResult>;
  createMockEvents(conversationType: ConversationType, count: number): TranscriptSegment[];
};

function tokenExpiry(now: number, ttlSeconds = MAX_TOKEN_TTL_SECONDS): string {
  return new Date(now + ttlSeconds * 1000).toISOString();
}

function isSafeSessionId(value: string): boolean {
  return /^[a-zA-Z0-9_.:-]{8,120}$/.test(value);
}

function mockToken(input: {
  audioSource: AudioSourceType;
  sessionId: string;
  user: AuthUser;
  now?: number;
  ttlSeconds?: number;
  provider?: SttProvider;
  token?: string;
}): SttTokenResponse {
  const now = input.now ?? Date.now();
  const ttlSeconds = Math.min(MAX_TOKEN_TTL_SECONDS, input.ttlSeconds ?? MAX_TOKEN_TTL_SECONDS);
  return {
    provider: input.provider ?? "mock",
    token: input.token ?? `mock-stt-token:${input.sessionId}:${input.audioSource}`,
    expiresAt: tokenExpiry(now, ttlSeconds),
    ttlSeconds,
    scope: "transcribe",
    boundUserId: input.user.id,
    boundSessionId: input.sessionId,
    audioSource: input.audioSource,
    directStreaming: true,
    websocketUrl: null,
    connectionType: input.provider === "openai" ? "webrtc" : "mock",
    realtimeUrl: input.provider === "openai" ? OPENAI_REALTIME_CALLS_URL : null
  };
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseOpenAiClientSecret(input: {
  data: unknown;
  now: number;
}):
  | {
      ok: true;
      token: string;
      ttlSeconds: number;
    }
  | {
      ok: false;
      reason: "missing_token" | "expired";
    } {
  const root = readObject(input.data);
  const nested = readObject(root?.client_secret);
  const candidate = nested ?? root;
  const token = candidate?.value;

  if (typeof token !== "string" || token.length === 0) {
    return {
      ok: false,
      reason: "missing_token"
    };
  }

  const expiresAtSeconds = candidate?.expires_at;
  if (typeof expiresAtSeconds !== "number" || !Number.isFinite(expiresAtSeconds)) {
    return {
      ok: true,
      token,
      ttlSeconds: MAX_TOKEN_TTL_SECONDS
    };
  }

  const ttlSeconds = Math.floor(expiresAtSeconds - Math.floor(input.now / 1000));
  if (ttlSeconds <= 0) {
    return {
      ok: false,
      reason: "expired"
    };
  }

  return {
    ok: true,
    token,
    ttlSeconds: Math.min(MAX_TOKEN_TTL_SECONDS, ttlSeconds)
  };
}

export const mockSttAdapter: SttAdapter = {
  name: "mock",
  async createToken(input) {
    if (!isSafeSessionId(input.sessionId)) {
      return {
        ok: false,
        diagnostic: {
          code: "invalid_config",
          category: "stt",
          provider: "mock",
          message: "A safe sessionId is required for STT token binding.",
          retryable: false,
          severity: "error",
          notRun: true
        }
      };
    }

    return {
      ok: true,
      stt: mockToken(input)
    };
  },
  createMockEvents(conversationType, count) {
    return Array.from({ length: count }, (_, index) => createDummyTranscriptPair(conversationType, index).final);
  }
};

export const openAiSttAdapter: SttAdapter = {
  ...mockSttAdapter,
  name: "openai",
  async createToken(input) {
    if (!input.apiKey) {
      return {
        ok: false,
        diagnostic: {
          code: "missing_env",
          category: "stt",
          provider: "openai",
          message: "OpenAI STT is selected but STT_API_KEY is missing.",
          retryable: false,
          severity: "error",
          envNames: ["STT_API_KEY"],
          notRun: true
        }
      };
    }
    if (!isSafeSessionId(input.sessionId)) {
      return {
        ok: false,
        diagnostic: {
          code: "invalid_config",
          category: "stt",
          provider: "openai",
          message: "A safe sessionId is required for STT token binding.",
          retryable: false,
          severity: "error",
          notRun: true
        }
      };
    }

    try {
      const fetcher = input.fetcher ?? fetch;
      const response = await fetcher("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Safety-Identifier": input.user.id
        },
        signal: AbortSignal.timeout(input.timeoutMs ?? 12_000),
        body: JSON.stringify({
          session: {
            type: "transcription",
            audio: {
              input: {
                transcription: {
                  model: "gpt-realtime-whisper",
                  delay: "low"
                }
              }
            }
          }
        })
      });

      if (!response.ok) {
        return {
          ok: false,
          diagnostic: normalizeProviderError(`OpenAI STT token failed: ${response.status}`, {
            category: "stt",
            provider: "openai"
          })
        };
      }

      const now = input.now ?? Date.now();
      const clientSecret = parseOpenAiClientSecret({
        data: await response.json(),
        now
      });

      if (!clientSecret.ok) {
        return {
          ok: false,
          diagnostic: {
            code: "schema_mismatch",
            category: "stt",
            provider: "openai",
            message:
              "OpenAI STT token response did not include a valid short-lived client secret schema.",
            retryable: false,
            severity: "error"
          }
        };
      }

      return {
        ok: true,
        stt: mockToken({
          ...input,
          provider: "openai",
          token: clientSecret.token,
          ttlSeconds: clientSecret.ttlSeconds
        })
      };
    } catch (error) {
      return {
        ok: false,
        diagnostic: normalizeProviderError(error, {
          category: "stt",
          provider: "openai"
        })
      };
    }
  }
};

export function getSttAdapter(provider: SttProvider = "mock"): SttAdapter {
  return provider === "openai" ? openAiSttAdapter : mockSttAdapter;
}
