import { describe, expect, it } from "vitest";
import {
  assertNoSensitiveSentinel,
  createInMemoryRateLimiter,
  createNoStoreHeaders,
  redactForLog
} from "@/lib/security";

describe("security guardrails", () => {
  it("redacts sensitive keys and secret-looking values before logging", () => {
    const redacted = redactForLog({
      transcript: "会話本文sentinel",
      nested: {
        providerError: "Bearer sk-provider-secret-sentinel should not leak",
        safe: "status"
      }
    });

    expect(JSON.stringify(redacted)).not.toContain("会話本文sentinel");
    expect(JSON.stringify(redacted)).not.toContain("sk-provider-secret-sentinel");
    expect(redacted).toMatchObject({
      transcript: "[REDACTED]"
    });
  });

  it("marks all API responses as no-store and body logging disabled", () => {
    expect(createNoStoreHeaders()).toMatchObject({
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      "X-RQC-Body-Logging": "disabled",
      "X-RQC-Storage-Policy": "browser-memory-first"
    });
  });

  it("detects sensitive sentinels in test artifacts", () => {
    expect(assertNoSensitiveSentinel({ diagnostic: "safe" }, ["secret-sentinel"])).toBe(true);
    expect(assertNoSensitiveSentinel({ diagnostic: "secret-sentinel" }, ["secret-sentinel"])).toBe(false);
  });

  it("rate limits by authenticated user and session, not spoofed forwarded IP", () => {
    const limiter = createInMemoryRateLimiter({
      maxRequests: 2,
      windowMs: 60_000
    });

    expect(
      limiter.check({
        route: "coach",
        userId: "user-1",
        sessionId: "session-1",
        forwardedFor: "1.1.1.1",
        now: 100
      }).ok
    ).toBe(true);
    expect(
      limiter.check({
        route: "coach",
        userId: "user-1",
        sessionId: "session-1",
        forwardedFor: "2.2.2.2",
        now: 200
      }).ok
    ).toBe(true);
    expect(
      limiter.check({
        route: "coach",
        userId: "user-1",
        sessionId: "session-1",
        forwardedFor: "3.3.3.3",
        now: 300
      })
    ).toMatchObject({
      ok: false,
      retryAfterSeconds: 60
    });
  });

  it("does not allow provider rate-limit bypass by rotating client session ids", () => {
    const limiter = createInMemoryRateLimiter({
      maxRequests: 2,
      windowMs: 60_000
    });

    expect(
      limiter.check({
        route: "report",
        userId: "user-1",
        sessionId: "session-a",
        now: 100
      }).ok
    ).toBe(true);
    expect(
      limiter.check({
        route: "report",
        userId: "user-1",
        sessionId: "session-b",
        now: 200
      }).ok
    ).toBe(true);
    expect(
      limiter.check({
        route: "report",
        userId: "user-1",
        sessionId: "session-c",
        now: 300
      }).ok
    ).toBe(false);
  });
});
