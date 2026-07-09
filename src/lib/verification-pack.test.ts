import { describe, expect, it } from "vitest";
import { decideRealProviderSmoke } from "@/lib/verification-pack";

describe("real-provider verification pack", () => {
  it("skips real provider smoke by default and records not_run without secret values", () => {
    const decision = decideRealProviderSmoke({
      enabled: undefined,
      provider: "openai",
      requiredEnvNames: ["OPENAI_API_KEY", "LLM_MODEL_REALTIME"],
      env: {
        OPENAI_API_KEY: "sk-real-secret-sentinel",
        LLM_MODEL_REALTIME: "gpt-test"
      } as unknown as NodeJS.ProcessEnv
    });

    expect(decision).toEqual({
      run: false,
      provider: "openai",
      requiredEnvNames: ["OPENAI_API_KEY", "LLM_MODEL_REALTIME"],
      reason: "disabled",
      notRun: true
    });
    expect(JSON.stringify(decision)).not.toContain("sk-real-secret-sentinel");
  });

  it("keeps missing-env skip separate from pass", () => {
    expect(
      decideRealProviderSmoke({
        enabled: "1",
        provider: "anthropic",
        requiredEnvNames: ["ANTHROPIC_API_KEY", "LLM_MODEL_REPORT"],
        env: {
          ANTHROPIC_API_KEY: "sk-ant-secret"
        } as unknown as NodeJS.ProcessEnv
      })
    ).toEqual({
      run: false,
      provider: "anthropic",
      requiredEnvNames: ["LLM_MODEL_REPORT"],
      reason: "missing_env",
      notRun: true
    });
  });
});
