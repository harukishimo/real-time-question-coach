import { describe, expect, it, vi } from "vitest";
import { getSttAdapter } from "@/lib/stt";
import type { AuthUser } from "@/lib/types";

const user: AuthUser = {
  id: "user-001",
  email: "user@example.test",
  role: "owner",
  provider: "google"
};

describe("STT token provider contract", () => {
  it("creates short-lived mock tokens bound to user and session", async () => {
    const result = await getSttAdapter("mock").createToken({
      audioSource: "microphone",
      sessionId: "session-12345",
      user,
      now: 1_000
    });

    expect(result).toMatchObject({
      ok: true,
      stt: {
        provider: "mock",
        ttlSeconds: 300,
        boundUserId: "user-001",
        boundSessionId: "session-12345",
        scope: "transcribe",
        audioSource: "microphone"
      }
    });
    if (result.ok) {
      expect(new Date(result.stt.expiresAt).getTime()).toBe(301_000);
    }
  });

  it("fails closed when real OpenAI STT is selected without a server key", async () => {
    const result = await getSttAdapter("openai").createToken({
      audioSource: "browser_tab",
      sessionId: "session-12345",
      user
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostic: {
        code: "missing_env",
        envNames: ["STT_API_KEY"],
        notRun: true
      }
    });
  });

  it("does not expose provider master secret and maps client secret into token response", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          client_secret: {
            value: "ephemeral-client-secret",
            expires_at: 123
          }
        }),
        { status: 200 }
      )
    );

    const result = await getSttAdapter("openai").createToken({
      audioSource: "microphone",
      sessionId: "session-12345",
      user,
      apiKey: "server-master-secret",
      fetcher: fetcher as unknown as typeof fetch,
      now: 1_000
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/client_secrets",
      expect.objectContaining({
        method: "POST",
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
      })
    );
    expect(result).toMatchObject({
      ok: true,
      stt: {
        provider: "openai",
        token: "ephemeral-client-secret",
        boundUserId: "user-001",
        connectionType: "webrtc",
        realtimeUrl: "https://api.openai.com/v1/realtime/calls"
      }
    });
    expect(JSON.stringify(result)).not.toContain("server-master-secret");
  });

  it("uses provider expiry to cap token ttl and rejects expired or oversized ttl", async () => {
    const validFetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          client_secret: {
            value: "ephemeral-client-secret",
            expires_at: 1_120
          }
        }),
        { status: 200 }
      )
    );
    const expiredFetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          client_secret: {
            value: "expired-client-secret",
            expires_at: 999
          }
        }),
        { status: 200 }
      )
    );
    const oversizedFetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          client_secret: {
            value: "long-client-secret",
            expires_at: 2_000
          }
        }),
        { status: 200 }
      )
    );

    const valid = await getSttAdapter("openai").createToken({
      audioSource: "microphone",
      sessionId: "session-12345",
      user,
      apiKey: "server-master-secret",
      fetcher: validFetcher as unknown as typeof fetch,
      now: 1_000_000
    });
    const expired = await getSttAdapter("openai").createToken({
      audioSource: "microphone",
      sessionId: "session-12345",
      user,
      apiKey: "server-master-secret",
      fetcher: expiredFetcher as unknown as typeof fetch,
      now: 1_000_000
    });
    const oversized = await getSttAdapter("openai").createToken({
      audioSource: "microphone",
      sessionId: "session-12345",
      user,
      apiKey: "server-master-secret",
      fetcher: oversizedFetcher as unknown as typeof fetch,
      now: 1_000_000
    });

    expect(valid).toMatchObject({
      ok: true,
      stt: {
        ttlSeconds: 120
      }
    });
    expect(expired).toMatchObject({
      ok: false,
      diagnostic: {
        code: "schema_mismatch"
      }
    });
    expect(oversized).toMatchObject({
      ok: false,
      diagnostic: {
        code: "schema_mismatch"
      }
    });
  });

  it("rejects STT token schema drift with wrong field types", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          client_secret: {
            value: 123,
            expires_at: "soon"
          }
        }),
        { status: 200 }
      )
    );

    const result = await getSttAdapter("openai").createToken({
      audioSource: "microphone",
      sessionId: "session-12345",
      user,
      apiKey: "server-master-secret",
      fetcher: fetcher as unknown as typeof fetch
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostic: {
        code: "schema_mismatch"
      }
    });
  });

  it("passes an abort timeout signal to real STT provider fetch and normalizes timeout failures", async () => {
    let signalWasProvided = false;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      signalWasProvided = init?.signal instanceof AbortSignal;
      throw new Error("provider timeout");
    });

    const result = await getSttAdapter("openai").createToken({
      audioSource: "microphone",
      sessionId: "session-12345",
      user,
      apiKey: "server-master-secret",
      fetcher: fetcher as unknown as typeof fetch,
      timeoutMs: 10
    });

    expect(signalWasProvided).toBe(true);
    expect(result).toMatchObject({
      ok: false,
      diagnostic: {
        code: "provider_timeout"
      }
    });
  });

  it("rejects unsafe session ids before issuing a token", async () => {
    const result = await getSttAdapter("mock").createToken({
      audioSource: "dummy",
      sessionId: "bad id with spaces",
      user
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostic: {
        code: "invalid_config"
      }
    });
  });
});
