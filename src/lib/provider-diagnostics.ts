export type ProviderCategory = "auth" | "stt" | "llm" | "report" | "diagnostics" | "storage";

export type ProviderDiagnosticCode =
  | "missing_env"
  | "invalid_config"
  | "unauthenticated"
  | "forbidden"
  | "rate_limited"
  | "provider_timeout"
  | "provider_denied"
  | "provider_quota"
  | "schema_mismatch"
  | "provider_unavailable"
  | "not_run"
  | "unknown_error";

export type SafeProviderDiagnostic = {
  code: ProviderDiagnosticCode;
  category: ProviderCategory;
  provider: string;
  message: string;
  retryable: boolean;
  severity: "info" | "warning" | "error";
  envNames?: string[];
  notRun?: boolean;
};

const RAW_SECRET_PATTERN =
  /(sk-[a-z0-9_-]{12,}|Bearer\s+[a-z0-9._-]+|api[_-]?key|secret|authorization|token)/i;

export function createMissingEnvDiagnostic(input: {
  category: ProviderCategory;
  provider: string;
  envNames: string[];
}): SafeProviderDiagnostic {
  return {
    code: "missing_env",
    category: input.category,
    provider: input.provider,
    message: `${input.provider} is selected but required server-side environment variables are missing.`,
    retryable: false,
    severity: "error",
    envNames: input.envNames,
    notRun: true
  };
}

export function createInvalidConfigDiagnostic(input: {
  category: ProviderCategory;
  provider: string;
  message: string;
}): SafeProviderDiagnostic {
  return {
    code: "invalid_config",
    category: input.category,
    provider: input.provider,
    message: input.message,
    retryable: false,
    severity: "error",
    notRun: true
  };
}

export function createNotRunDiagnostic(input: {
  category: ProviderCategory;
  provider: string;
  envNames?: string[];
  message?: string;
}): SafeProviderDiagnostic {
  return {
    code: "not_run",
    category: input.category,
    provider: input.provider,
    message: input.message ?? "Real provider execution was not run in this environment.",
    retryable: false,
    severity: "info",
    envNames: input.envNames,
    notRun: true
  };
}

export function normalizeProviderError(
  error: unknown,
  input: {
    category: ProviderCategory;
    provider: string;
    defaultCode?: ProviderDiagnosticCode;
  }
): SafeProviderDiagnostic {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Provider request failed.";
  const normalized = rawMessage.toLowerCase();

  let code: ProviderDiagnosticCode = input.defaultCode ?? "provider_unavailable";
  let retryable = true;

  if (normalized.includes("timeout") || normalized.includes("abort")) {
    code = "provider_timeout";
  } else if (normalized.includes("rate") || normalized.includes("429")) {
    code = "rate_limited";
  } else if (normalized.includes("quota")) {
    code = "provider_quota";
  } else if (
    normalized.includes("401") ||
    normalized.includes("403") ||
    normalized.includes("auth") ||
    normalized.includes("permission")
  ) {
    code = "provider_denied";
    retryable = false;
  } else if (normalized.includes("schema") || normalized.includes("json")) {
    code = "schema_mismatch";
    retryable = false;
  }

  return {
    code,
    category: input.category,
    provider: input.provider,
    message: safeProviderMessage(rawMessage),
    retryable,
    severity: "error"
  };
}

export function safeProviderMessage(message: string): string {
  if (RAW_SECRET_PATTERN.test(message)) {
    return "Provider returned an error. Sensitive details were redacted.";
  }

  if (message.length > 140) {
    return `${message.slice(0, 96)}...[redacted:${message.length}]`;
  }

  return message;
}

export function publicDiagnosticSummary(diagnostics: SafeProviderDiagnostic[]) {
  return diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    category: diagnostic.category,
    provider: sanitizeProviderName(diagnostic.provider),
    message: safeProviderMessage(diagnostic.message),
    retryable: diagnostic.retryable,
    severity: diagnostic.severity,
    envNames: diagnostic.envNames,
    notRun: diagnostic.notRun ?? false
  }));
}

export function sanitizeProviderName(provider: string): string {
  if (/^(mock|openai|anthropic|supabase|server-runtime|NEXT_PUBLIC_|RQC_|LLM_|STT_|diagnostics|report|stt|llm|auth)/.test(provider)) {
    return provider;
  }

  if (RAW_SECRET_PATTERN.test(provider) || provider.length > 40) {
    return "[redacted-provider]";
  }

  return provider.replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 40) || "[redacted-provider]";
}
