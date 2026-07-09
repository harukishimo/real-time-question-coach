import {
  createInvalidConfigDiagnostic,
  createMissingEnvDiagnostic,
  type SafeProviderDiagnostic
} from "@/lib/provider-diagnostics";

const SERVER_ONLY_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "STT_API_KEY",
  "STT_PROVIDER_SECRET",
  "LLM_API_KEY"
] as const;

const PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_RQC_AUTH_MODE",
  "NEXT_PUBLIC_RQC_PROVIDER_MODE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
] as const;

export type AuthMode = "mock" | "supabase";
export type ProviderMode = "mock" | "real";
export type LlmProvider = "mock" | "openai" | "anthropic";
export type SttProvider = "mock" | "openai";

export type PublicRuntimeConfig = {
  authMode: AuthMode;
  providerMode: ProviderMode;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  diagnostics: SafeProviderDiagnostic[];
};

export type ServerRuntimeConfig = PublicRuntimeConfig & {
  llmProvider: LlmProvider;
  sttProvider: SttProvider;
  realtimeModel?: string;
  reportModel?: string;
  missingRequiredServerKeys: string[];
  providerReady: boolean;
};

function readEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseChoice<T extends string>(input: {
  raw: string | undefined;
  allowed: readonly T[];
  fallback: T;
  envName: string;
  category: "auth" | "stt" | "llm" | "diagnostics";
  diagnostics: SafeProviderDiagnostic[];
}): T {
  if (!input.raw) return input.fallback;

  const normalized = input.raw.toLowerCase();
  if (input.allowed.includes(normalized as T)) {
    return normalized as T;
  }

  input.diagnostics.push(
    createInvalidConfigDiagnostic({
      category: input.category,
      provider: input.envName,
      message: `${input.envName} has unsupported value. Allowed values: ${input.allowed.join(", ")}.`
    })
  );
  return input.fallback;
}

function isProviderCompatibleModel(provider: LlmProvider, model: string | undefined): boolean {
  if (provider === "mock") return true;
  if (!model) return false;
  if (provider === "openai") return /^(gpt-|o[0-9]|chatgpt-)/i.test(model);
  return /^claude-/i.test(model);
}

export function getServerOnlyEnvKeys(): string[] {
  return [...SERVER_ONLY_ENV_KEYS];
}

export function getClientExposedEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  return PUBLIC_ENV_KEYS.reduce<Record<string, string>>((acc, key) => {
    const value = readEnv(env, key);
    if (value) acc[key] = value;
    return acc;
  }, {});
}

export function findServerOnlyEnvLeakKeys(record: Record<string, unknown>): string[] {
  return SERVER_ONLY_ENV_KEYS.filter((key) => key in record);
}

export function getPublicRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): PublicRuntimeConfig {
  const diagnostics: SafeProviderDiagnostic[] = [];
  const authMode = parseChoice<AuthMode>({
    raw: readEnv(env, "NEXT_PUBLIC_RQC_AUTH_MODE"),
    allowed: ["mock", "supabase"],
    fallback: "mock",
    envName: "NEXT_PUBLIC_RQC_AUTH_MODE",
    category: "auth",
    diagnostics
  });
  const providerMode = parseChoice<ProviderMode>({
    raw: readEnv(env, "NEXT_PUBLIC_RQC_PROVIDER_MODE"),
    allowed: ["mock", "real"],
    fallback: "mock",
    envName: "NEXT_PUBLIC_RQC_PROVIDER_MODE",
    category: "diagnostics",
    diagnostics
  });
  const supabaseUrl = readEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = readEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (authMode === "supabase") {
    const missing = [
      supabaseUrl ? null : "NEXT_PUBLIC_SUPABASE_URL",
      supabaseAnonKey ? null : "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    ].filter((value): value is string => Boolean(value));
    if (missing.length > 0) {
      diagnostics.push(
        createMissingEnvDiagnostic({
          category: "auth",
          provider: "supabase",
          envNames: missing
        })
      );
    }
    if (supabaseUrl && !/^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(supabaseUrl)) {
      diagnostics.push(
        createInvalidConfigDiagnostic({
          category: "auth",
          provider: "supabase",
          message: "NEXT_PUBLIC_SUPABASE_URL must be an https Supabase project URL."
        })
      );
    }
  }

  return {
    authMode,
    providerMode,
    supabaseUrl,
    supabaseAnonKey,
    diagnostics
  };
}

export function getServerRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): ServerRuntimeConfig {
  const publicConfig = getPublicRuntimeConfig(env);
  const diagnostics = [...publicConfig.diagnostics];
  const llmProvider = parseChoice<LlmProvider>({
    raw: readEnv(env, "RQC_LLM_PROVIDER"),
    allowed: ["mock", "openai", "anthropic"],
    fallback: "mock",
    envName: "RQC_LLM_PROVIDER",
    category: "llm",
    diagnostics
  });
  const sttProvider = parseChoice<SttProvider>({
    raw: readEnv(env, "RQC_STT_PROVIDER"),
    allowed: ["mock", "openai"],
    fallback: "mock",
    envName: "RQC_STT_PROVIDER",
    category: "stt",
    diagnostics
  });
  const realtimeModel = readEnv(env, "LLM_MODEL_REALTIME");
  const reportModel = readEnv(env, "LLM_MODEL_REPORT");
  const missingRequiredServerKeys: string[] = [];

  if (llmProvider === "openai" && !readEnv(env, "OPENAI_API_KEY")) {
    missingRequiredServerKeys.push("OPENAI_API_KEY");
  }
  if (llmProvider === "anthropic" && !readEnv(env, "ANTHROPIC_API_KEY")) {
    missingRequiredServerKeys.push("ANTHROPIC_API_KEY");
  }
  if (llmProvider !== "mock" && !realtimeModel) {
    missingRequiredServerKeys.push("LLM_MODEL_REALTIME");
  }
  if (llmProvider !== "mock" && !reportModel) {
    missingRequiredServerKeys.push("LLM_MODEL_REPORT");
  }
  if (sttProvider === "openai" && !readEnv(env, "STT_API_KEY")) {
    missingRequiredServerKeys.push("STT_API_KEY");
  }

  if (
    publicConfig.providerMode === "real" &&
    (llmProvider === "mock" || sttProvider === "mock")
  ) {
    diagnostics.push(
      createInvalidConfigDiagnostic({
        category: "diagnostics",
        provider: "NEXT_PUBLIC_RQC_PROVIDER_MODE",
        message:
          "NEXT_PUBLIC_RQC_PROVIDER_MODE=real requires non-mock RQC_LLM_PROVIDER and RQC_STT_PROVIDER."
      })
    );
  }

  if (llmProvider !== "mock" && realtimeModel && !isProviderCompatibleModel(llmProvider, realtimeModel)) {
    diagnostics.push(
      createInvalidConfigDiagnostic({
        category: "llm",
        provider: "LLM_MODEL_REALTIME",
        message: `LLM_MODEL_REALTIME is not compatible with ${llmProvider}.`
      })
    );
  }

  if (llmProvider !== "mock" && reportModel && !isProviderCompatibleModel(llmProvider, reportModel)) {
    diagnostics.push(
      createInvalidConfigDiagnostic({
        category: "llm",
        provider: "LLM_MODEL_REPORT",
        message: `LLM_MODEL_REPORT is not compatible with ${llmProvider}.`
      })
    );
  }

  if (missingRequiredServerKeys.length > 0) {
    diagnostics.push(
      createMissingEnvDiagnostic({
        category: "diagnostics",
        provider: "server-runtime",
        envNames: [...new Set(missingRequiredServerKeys)]
      })
    );
  }

  return {
    ...publicConfig,
    diagnostics,
    llmProvider,
    sttProvider,
    realtimeModel,
    reportModel,
    missingRequiredServerKeys: [...new Set(missingRequiredServerKeys)],
    providerReady: diagnostics.every((diagnostic) => diagnostic.severity !== "error")
  };
}
