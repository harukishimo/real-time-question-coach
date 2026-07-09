export type RealProviderSmokeDecision =
  | {
      run: true;
      provider: string;
      requiredEnvNames: string[];
    }
  | {
      run: false;
      provider: string;
      requiredEnvNames: string[];
      reason: "disabled" | "missing_env";
      notRun: true;
    };

export function decideRealProviderSmoke(input: {
  enabled?: string;
  provider: string;
  requiredEnvNames: string[];
  env: NodeJS.ProcessEnv;
}): RealProviderSmokeDecision {
  if (input.enabled !== "1") {
    return {
      run: false,
      provider: input.provider,
      requiredEnvNames: input.requiredEnvNames,
      reason: "disabled",
      notRun: true
    };
  }

  const missing = input.requiredEnvNames.filter((envName) => !input.env[envName]?.trim());
  if (missing.length > 0) {
    return {
      run: false,
      provider: input.provider,
      requiredEnvNames: missing,
      reason: "missing_env",
      notRun: true
    };
  }

  return {
    run: true,
    provider: input.provider,
    requiredEnvNames: input.requiredEnvNames
  };
}
