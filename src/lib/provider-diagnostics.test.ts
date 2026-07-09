import { describe, expect, it } from "vitest";
import {
  normalizeProviderError,
  publicDiagnosticSummary,
  sanitizeProviderName
} from "@/lib/provider-diagnostics";

describe("provider diagnostics taxonomy", () => {
  it.each([
    ["request timeout", "provider_timeout", true],
    ["HTTP 429 rate limit", "rate_limited", true],
    ["quota exceeded", "provider_quota", true],
    ["401 authorization failed", "provider_denied", false],
    ["json schema mismatch", "schema_mismatch", false]
  ])("maps %s into %s", (message, code, retryable) => {
    expect(
      normalizeProviderError(message, {
        category: "llm",
        provider: "openai"
      })
    ).toMatchObject({
      code,
      retryable
    });
  });

  it("redacts raw provider secret-like errors before public diagnostics", () => {
    const diagnostic = normalizeProviderError("Bearer sk-secret-provider-token leaked", {
      category: "stt",
      provider: "sk-secret-provider-token"
    });
    const summary = publicDiagnosticSummary([diagnostic]);

    expect(summary[0]).toMatchObject({
      provider: "[redacted-provider]",
      message: "Provider returned an error. Sensitive details were redacted."
    });
    expect(JSON.stringify(summary)).not.toContain("sk-secret-provider-token");
  });

  it("sanitizes arbitrary invalid provider names", () => {
    expect(sanitizeProviderName("evil provider<script>")).toBe("evilproviderscript");
    expect(sanitizeProviderName("sk-secret-provider-value")).toBe("[redacted-provider]");
  });
});
