import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST as postCoach } from "@/app/api/coach/route";
import { POST as postReport } from "@/app/api/report/route";
import { POST as postSession } from "@/app/api/session/init/route";
import { POST as postSttToken } from "@/app/api/stt-token/route";
import { GET as getDiagnostics } from "@/app/api/diagnostics/route";
import { countCardsByStatus } from "@/lib/coach-card";
import { createSessionProfile } from "@/lib/session-profile";
import { providerRateLimiter } from "@/lib/security";
import type { CoachCard, SessionSetupInput } from "@/lib/types";

const authHeaders = {
  "Content-Type": "application/json",
  "x-rqc-dev-user": "true",
  "x-rqc-role": "owner"
};

const setupInput: SessionSetupInput = {
  conversationType: "requirements",
  industry: "it",
  purpose: "権限と保存方針を確認する",
  mustCheckItems: ["権限", "保存方針"],
  audioSource: "dummy",
  consentNoServerStorage: true
};

function existingCoachCard(index: number, score: number): CoachCard {
  return {
    id: `existing-${index}`,
    title: `既存確認${index}`,
    question: `既存質問${index}は確認済みですか？`,
    reason: "api regression",
    priority: "medium",
    score,
    status: "active",
    sourceSegmentIds: [`existing-${index}`],
    ruleIds: ["api-regression"],
    createdAt: new Date(0).toISOString()
  };
}

function apiRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: headers ?? { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }) as unknown as NextRequest;
}

describe("api routes", () => {
  beforeEach(() => {
    providerRateLimiter.reset();
    vi.stubEnv("DEV_AUTH_ENABLED", "true");
    vi.stubEnv("RQC_LOCAL_RUNTIME", "true");
    vi.stubEnv("NEXT_PUBLIC_RQC_AUTH_MODE", "mock");
    vi.stubEnv("RQC_LLM_PROVIDER", "mock");
    vi.stubEnv("RQC_STT_PROVIDER", "mock");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects unauthenticated access to protected MVP APIs", async () => {
    const responses = await Promise.all([
      postSession(apiRequest({ setupInput })),
      postCoach(apiRequest({})),
      postReport(apiRequest({})),
      postSttToken(apiRequest({ audioSource: "dummy", sessionId: "session-unauth" })),
      getDiagnostics(apiRequest(null))
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401]);
  });

  it("rejects dev auth headers unless DEV_AUTH_ENABLED is explicitly true", async () => {
    vi.stubEnv("DEV_AUTH_ENABLED", "false");

    const response = await postSession(apiRequest({ setupInput }, authHeaders));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "dev_auth_disabled"
      }
    });
  });

  it("rejects dev auth headers unless local runtime is explicitly true", async () => {
    vi.stubEnv("RQC_LOCAL_RUNTIME", "false");

    const response = await postSession(apiRequest({ setupInput }, authHeaders));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "dev_auth_disabled"
      }
    });
  });

  it("creates a session profile without server conversation persistence", async () => {
    const response = await postSession(apiRequest({ setupInput }, authHeaders));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sessionProfile).toMatchObject({
      conversationType: "requirements",
      industry: "it",
      audioSource: "dummy"
    });
    expect(body.storagePolicy).toEqual({
      browserMemoryPrimary: true,
      serverConversationPersistence: false,
      serverBodyLogging: false
    });
  });

  it("creates a session profile from the minimum required setup fields", async () => {
    const response = await postSession(
      apiRequest(
        {
          setupInput: {
            conversationType: "requirements",
            industry: "it",
            purpose: "要件定義で確認する"
          }
        },
        authHeaders
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sessionProfile).toMatchObject({
      conversationType: "requirements",
      industry: "it",
      audioSource: "dummy"
    });
    expect(body.storagePolicy).toMatchObject({
      browserMemoryPrimary: true,
      serverConversationPersistence: false,
      serverBodyLogging: false
    });
  });

  it("rejects invalid session setup input", async () => {
    const response = await postSession(
      apiRequest(
        {
          setupInput: {
            ...setupInput,
            purpose: "",
            consentNoServerStorage: false
          }
        },
        authHeaders
      )
    );

    expect(response.status).toBe(422);
  });

  it("returns coach cards with no server persistence policy", async () => {
    const sessionProfile = createSessionProfile(setupInput);
    const response = await postCoach(
      apiRequest(
        {
          sessionProfile,
          transcriptSegments: [
            {
              id: "seg-1-final",
              sequence: 1,
              speaker: { id: "participant", label: "相手", source: "fixture", confidence: 1 },
              text: "必須なのは権限ごとの閲覧制御です。",
              isFinal: true,
              startedAtMs: 0,
              endedAtMs: 1000,
              createdAt: new Date().toISOString()
            }
          ],
          existingCards: [],
          lastLlmCallAt: 0
        },
        authHeaders
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.storagePolicy).toEqual({
      persistedToServer: false,
      bodyLogged: false
    });
    expect(body.cards.length).toBeGreaterThan(0);
  });

  it("returns local fallback coach cards when real LLM response schema mismatches", async () => {
    vi.stubEnv("RQC_LLM_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");
    vi.stubEnv("LLM_MODEL_REALTIME", "gpt-5-mini");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ invalid: true }), { status: 200 }))
    );

    const sessionProfile = createSessionProfile(setupInput);
    const response = await postCoach(
      apiRequest(
        {
          sessionProfile,
          transcriptSegments: [
            {
              id: "seg-schema-fallback",
              sequence: 1,
              speaker: { id: "participant", label: "相手", source: "fixture", confidence: 1 },
              text: "権限ごとの承認者はまだ決まっていません。",
              isFinal: true,
              startedAtMs: 0,
              endedAtMs: 1000,
              createdAt: new Date().toISOString()
            }
          ],
          existingCards: [],
          lastLlmCallAt: 0
        },
        authHeaders
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.diagnostic).toMatchObject({
      code: "schema_mismatch",
      category: "llm",
      provider: "openai"
    });
    expect(body.cards.length).toBeGreaterThan(0);
  });

  it("normalizes client-supplied existing active cards before returning coach cards", async () => {
    const sessionProfile = createSessionProfile(setupInput);
    const response = await postCoach(
      apiRequest(
        {
          sessionProfile,
          transcriptSegments: [],
          existingCards: [
            existingCoachCard(1, 88),
            existingCoachCard(2, 77),
            existingCoachCard(3, 99),
            existingCoachCard(4, 66)
          ],
          lastLlmCallAt: Date.now()
        },
        authHeaders
      )
    );
    const body = (await response.json()) as { cards: CoachCard[] };

    expect(response.status).toBe(200);
    expect(countCardsByStatus(body.cards).active).toBeLessThanOrEqual(3);
    expect(countCardsByStatus(body.cards).queued).toBeGreaterThanOrEqual(1);
  });

  it("normalizes client-supplied existing active cards with duplicated ids", async () => {
    const sessionProfile = createSessionProfile(setupInput);
    const response = await postCoach(
      apiRequest(
        {
          sessionProfile,
          transcriptSegments: [],
          existingCards: [
            { ...existingCoachCard(1, 88), id: "dup" },
            { ...existingCoachCard(2, 77), id: "dup" },
            { ...existingCoachCard(3, 99), id: "dup" },
            { ...existingCoachCard(4, 66), id: "dup" }
          ],
          lastLlmCallAt: Date.now()
        },
        authHeaders
      )
    );
    const body = (await response.json()) as { cards: CoachCard[] };

    expect(response.status).toBe(200);
    expect(countCardsByStatus(body.cards).active).toBe(3);
    expect(countCardsByStatus(body.cards).queued).toBeGreaterThanOrEqual(1);
  });

  it("does not demote a pinned existing card when a duplicate-id active card is replaced", async () => {
    const sessionProfile = createSessionProfile(setupInput);
    const response = await postCoach(
      apiRequest(
        {
          sessionProfile,
          transcriptSegments: [
            {
              id: "seg-duplicate-demotion",
              sequence: 1,
              speaker: { id: "participant", label: "相手", source: "fixture", confidence: 1 },
              text: "権限ごとの承認者はまだ決まっていません。",
              isFinal: true,
              startedAtMs: 0,
              endedAtMs: 1000,
              createdAt: new Date().toISOString()
            }
          ],
          existingCards: [
            { ...existingCoachCard(1, 100), id: "dup", status: "pinned" },
            { ...existingCoachCard(2, 10), id: "dup" },
            existingCoachCard(3, 20)
          ],
          lastLlmCallAt: 0
        },
        authHeaders
      )
    );
    const body = (await response.json()) as { cards: CoachCard[] };

    expect(response.status).toBe(200);
    expect(countCardsByStatus(body.cards).active).toBe(3);
    expect(body.cards.find((card) => card.id === "dup" && card.score === 100)?.status).toBe(
      "pinned"
    );
    expect(body.cards.find((card) => card.id === "dup" && card.score === 10)?.status).toBe(
      "queued"
    );
  });

  it("returns report and STT token boundaries without storing body or audio", async () => {
    const sessionProfile = createSessionProfile(setupInput);
    const reportResponse = await postReport(
      apiRequest(
        {
          sessionProfile,
          transcriptSegments: [],
          cards: []
        },
        authHeaders
      )
    );
    const tokenResponse = await postSttToken(
      apiRequest({ audioSource: "microphone", sessionId: sessionProfile.id }, authHeaders)
    );

    expect(reportResponse.status).toBe(200);
    await expect(reportResponse.json()).resolves.toMatchObject({
      storagePolicy: {
        persistedToServer: false,
        bodyLogged: false
      }
    });
    expect(tokenResponse.status).toBe(200);
    await expect(tokenResponse.json()).resolves.toMatchObject({
      storagePolicy: {
        audioStoredByApplication: false,
        longRunningRelayViaNextApi: false,
        bodyLogged: false
      }
    });
  });

  it("does not log sensitive API body content while returning no-store policy headers", async () => {
    const consoleSpies = (["debug", "error", "info", "log", "warn"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined)
    );
    const sessionProfile = createSessionProfile(setupInput);
    const sensitiveText = "これはAPI routeでログ出力してはいけない会話本文です";
    const cards = [existingCoachCard(1, 88)];
    const transcriptSegments = [
      {
        id: "seg-sensitive",
        sequence: 1,
        speaker: { id: "participant", label: "相手", source: "fixture", confidence: 1 },
        text: sensitiveText,
        isFinal: true,
        startedAtMs: 0,
        endedAtMs: 1000,
        createdAt: new Date().toISOString()
      }
    ];

    try {
      const responses = await Promise.all([
        postSession(apiRequest({ setupInput }, authHeaders)),
        postCoach(
          apiRequest(
            {
              sessionProfile,
              transcriptSegments,
              existingCards: cards,
              lastLlmCallAt: 0
            },
            authHeaders
          )
        ),
        postReport(apiRequest({ sessionProfile, transcriptSegments, cards }, authHeaders)),
        postSttToken(apiRequest({ audioSource: "dummy", sessionId: sessionProfile.id }, authHeaders))
      ]);

      expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
      expect(
        responses.map((response) => ({
          bodyLogging: response.headers.get("X-RQC-Body-Logging"),
          cacheControl: response.headers.get("Cache-Control"),
          storagePolicy: response.headers.get("X-RQC-Storage-Policy")
        }))
      ).toEqual([
        {
          bodyLogging: "disabled",
          cacheControl: "no-store",
          storagePolicy: "browser-memory-first"
        },
        {
          bodyLogging: "disabled",
          cacheControl: "no-store",
          storagePolicy: "browser-memory-first"
        },
        {
          bodyLogging: "disabled",
          cacheControl: "no-store",
          storagePolicy: "browser-memory-first"
        },
        {
          bodyLogging: "disabled",
          cacheControl: "no-store",
          storagePolicy: "browser-memory-first"
        }
      ]);
      expect(consoleSpies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    } finally {
      consoleSpies.forEach((spy) => spy.mockRestore());
    }
  });

  it("rejects audio body uploads to STT token API", async () => {
    const sessionProfile = createSessionProfile(setupInput);
    const response = await postSttToken(
      apiRequest(
        {
          audioSource: "microphone",
          sessionId: sessionProfile.id,
          audioBytes: "raw-audio-sentinel"
        },
        authHeaders
      )
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "audio_body_not_allowed"
      }
    });
  });

  it("rejects URL-like or huge audioSource values before token issuance", async () => {
    const sessionProfile = createSessionProfile(setupInput);
    const urlLike = await postSttToken(
      apiRequest(
        {
          audioSource: "https://example.test/audio.wav",
          sessionId: sessionProfile.id
        },
        authHeaders
      )
    );
    const huge = await postSttToken(
      apiRequest(
        {
          audioSource: "x".repeat(10_000),
          sessionId: sessionProfile.id
        },
        authHeaders
      )
    );

    expect(urlLike.status).toBe(422);
    expect(huge.status).toBe(422);
  });

  it("returns local fallback coach cards when real LLM provider env is missing", async () => {
    vi.stubEnv("RQC_LLM_PROVIDER", "anthropic");
    const sessionProfile = createSessionProfile(setupInput);
    const response = await postCoach(
      apiRequest(
        {
          sessionProfile,
          transcriptSegments: [
            {
              id: "seg-real-env",
              sequence: 1,
              speaker: { id: "participant", label: "相手", source: "fixture", confidence: 1 },
              text: "権限の判断者が曖昧です。",
              isFinal: true,
              startedAtMs: 0,
              endedAtMs: 1000,
              createdAt: new Date().toISOString()
            }
          ],
          existingCards: [],
          lastLlmCallAt: 0
        },
        authHeaders
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      provider: "mock",
      diagnostic: {
        code: "missing_env",
        category: "llm",
        provider: "anthropic"
      },
      cards: expect.arrayContaining([
        expect.objectContaining({
          question: expect.stringContaining("確認")
        })
      ])
    });
  });

  it("fails closed when real provider mode is enabled but providers remain mock", async () => {
    vi.stubEnv("NEXT_PUBLIC_RQC_PROVIDER_MODE", "real");
    const sessionProfile = createSessionProfile(setupInput);
    const response = await postCoach(
      apiRequest(
        {
          sessionProfile,
          transcriptSegments: [],
          existingCards: []
        },
        authHeaders
      )
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "invalid_config"
      },
      diagnostic: {
        category: "diagnostics"
      }
    });
  });

  it("rejects incompatible LLM model before provider dispatch", async () => {
    vi.stubEnv("RQC_LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-placeholder");
    vi.stubEnv("LLM_MODEL_REALTIME", "gpt-5-mini");
    vi.stubEnv("LLM_MODEL_REPORT", "claude-sonnet-test");
    const sessionProfile = createSessionProfile(setupInput);
    const response = await postCoach(
      apiRequest(
        {
          sessionProfile,
          transcriptSegments: [],
          existingCards: []
        },
        authHeaders
      )
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      diagnostic: {
        provider: "LLM_MODEL_REALTIME"
      }
    });
  });

  it("returns authenticated provider diagnostics without secret values or body content", async () => {
    vi.stubEnv("RQC_LLM_PROVIDER", "openai");
    const response = await getDiagnostics(
      apiRequest(null, authHeaders)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      authMode: "mock",
      llmProvider: "openai",
      providerReady: false
    });
    expect(body.missingRequiredServerKeys).toContain("OPENAI_API_KEY");
    expect(JSON.stringify(body)).not.toContain("sk-");
    expect(JSON.stringify(body)).not.toContain("会話本文");
  });

  it("rate limits provider-facing APIs before another provider dispatch", async () => {
    const sessionProfile = createSessionProfile(setupInput);
    const requests = Array.from({ length: 31 }, () =>
      postSttToken(apiRequest({ audioSource: "dummy", sessionId: sessionProfile.id }, authHeaders))
    );
    const responses = await Promise.all(requests);

    expect(responses.at(-1)?.status).toBe(429);
  });

  it("rate limits provider APIs even when client rotates session ids", async () => {
    const responses = await Promise.all(
      Array.from({ length: 31 }, (_, index) =>
        postSttToken(
          apiRequest(
            {
              audioSource: "dummy",
              sessionId: `session-rotate-${index}`
            },
            authHeaders
          )
        )
      )
    );

    expect(responses.at(-1)?.status).toBe(429);
  });
});
