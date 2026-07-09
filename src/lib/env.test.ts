import { describe, expect, it } from "vitest";
import {
  findServerOnlyEnvLeakKeys,
  getClientExposedEnv,
  getPublicRuntimeConfig,
  getServerRuntimeConfig,
  getServerOnlyEnvKeys
} from "@/lib/env";

describe("env boundaries", () => {
  it("does not expose server-only keys in the client env projection", () => {
    const exposed = getClientExposedEnv({
      NEXT_PUBLIC_RQC_AUTH_MODE: "mock",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.local",
      DEV_AUTH_ENABLED: "true",
      RQC_LOCAL_RUNTIME: "true",
      OPENAI_API_KEY: "server-only"
    } as unknown as NodeJS.ProcessEnv);

    expect(findServerOnlyEnvLeakKeys(exposed)).toEqual([]);
    expect(Object.keys(exposed)).not.toContain("OPENAI_API_KEY");
    expect(Object.keys(exposed)).not.toContain("DEV_AUTH_ENABLED");
    expect(Object.keys(exposed)).not.toContain("RQC_LOCAL_RUNTIME");
  });

  it("detects accidental server-only key exposure", () => {
    expect(findServerOnlyEnvLeakKeys({ SUPABASE_SERVICE_ROLE_KEY: "bad" })).toEqual([
      "SUPABASE_SERVICE_ROLE_KEY"
    ]);
  });

  it("defaults to mock providers without requiring real secrets", () => {
    const config = getServerRuntimeConfig({} as unknown as NodeJS.ProcessEnv);

    expect(config.authMode).toBe("mock");
    expect(config.llmProvider).toBe("mock");
    expect(config.sttProvider).toBe("mock");
    expect(config.missingRequiredServerKeys).toEqual([]);
    expect(getServerOnlyEnvKeys()).toContain("OPENAI_API_KEY");
  });

  it("supports OpenAI and Anthropic LLM provider readiness without exposing server keys", () => {
    const openAiConfig = getServerRuntimeConfig({
      RQC_LLM_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-test-openai-sentinel",
      LLM_MODEL_REALTIME: "gpt-5-mini",
      LLM_MODEL_REPORT: "gpt-5-mini"
    } as unknown as NodeJS.ProcessEnv);
    const anthropicConfig = getServerRuntimeConfig({
      RQC_LLM_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "sk-ant-test-sentinel",
      LLM_MODEL_REALTIME: "claude-sonnet-test",
      LLM_MODEL_REPORT: "claude-sonnet-test"
    } as unknown as NodeJS.ProcessEnv);

    expect(openAiConfig.providerReady).toBe(true);
    expect(anthropicConfig.providerReady).toBe(true);
    expect(getClientExposedEnv(process.env)).not.toHaveProperty("ANTHROPIC_API_KEY");
  });

  it("does not silently fall back to mock for unsupported providers or missing real env", () => {
    const invalid = getServerRuntimeConfig({
      RQC_LLM_PROVIDER: "unknown"
    } as unknown as NodeJS.ProcessEnv);
    const missing = getServerRuntimeConfig({
      RQC_LLM_PROVIDER: "anthropic"
    } as unknown as NodeJS.ProcessEnv);

    expect(invalid.providerReady).toBe(false);
    expect(invalid.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_config",
          category: "llm"
        })
      ])
    );
    expect(missing.missingRequiredServerKeys).toEqual([
      "ANTHROPIC_API_KEY",
      "LLM_MODEL_REALTIME",
      "LLM_MODEL_REPORT"
    ]);
  });

  it("normalizes whitespace and case while rejecting real mode with mock providers", () => {
    const config = getServerRuntimeConfig({
      NEXT_PUBLIC_RQC_PROVIDER_MODE: "real",
      RQC_LLM_PROVIDER: " OpenAI ",
      RQC_STT_PROVIDER: " mock ",
      OPENAI_API_KEY: "sk-test",
      LLM_MODEL_REALTIME: "gpt-5-mini",
      LLM_MODEL_REPORT: "gpt-5-mini"
    } as unknown as NodeJS.ProcessEnv);

    expect(config.llmProvider).toBe("openai");
    expect(config.sttProvider).toBe("mock");
    expect(config.providerReady).toBe(false);
    expect(config.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_config",
          category: "diagnostics"
        })
      ])
    );
  });

  it("blocks provider/model mismatches before real provider calls", () => {
    const config = getServerRuntimeConfig({
      RQC_LLM_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "sk-ant-test",
      LLM_MODEL_REALTIME: "gpt-5-mini",
      LLM_MODEL_REPORT: "claude-sonnet-test"
    } as unknown as NodeJS.ProcessEnv);

    expect(config.providerReady).toBe(false);
    expect(config.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_config",
          provider: "LLM_MODEL_REALTIME"
        })
      ])
    );
  });

  it("does not echo unsupported provider raw secret-like values in diagnostics", () => {
    const config = getServerRuntimeConfig({
      RQC_LLM_PROVIDER: "sk-secret-like-provider-value"
    } as unknown as NodeJS.ProcessEnv);

    expect(JSON.stringify(config.diagnostics)).not.toContain("sk-secret-like-provider-value");
  });

  it("keeps Supabase public config separate from service-role and reports callback config errors", () => {
    const config = getPublicRuntimeConfig({
      NEXT_PUBLIC_RQC_AUTH_MODE: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "http://evil.example.test",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_placeholder",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-sentinel"
    } as unknown as NodeJS.ProcessEnv);

    expect(config.authMode).toBe("supabase");
    expect(config.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_config",
          category: "auth"
        })
      ])
    );
    expect(findServerOnlyEnvLeakKeys(getClientExposedEnv(process.env))).toEqual([]);
  });
});
