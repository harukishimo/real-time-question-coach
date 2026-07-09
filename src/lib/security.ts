const SENSITIVE_KEY_PATTERN =
  /(audio|transcript|card|prompt|llm|report|token|secret|api[_-]?key|authorization|client[_-]?secret)/i;
const SECRET_VALUE_PATTERN = /(sk-[a-z0-9_-]{12,}|Bearer\s+[a-z0-9._-]+|sb_[a-z0-9_-]{12,})/i;

export function redactForLog(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entry]) => {
      acc[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redactForLog(entry);
      return acc;
    }, {});
  }

  if (typeof value === "string" && SECRET_VALUE_PATTERN.test(value)) {
    return "[REDACTED]";
  }

  if (typeof value === "string" && value.length > 80) {
    return `${value.slice(0, 24)}...[REDACTED:${value.length}]`;
  }

  return value;
}

export function assertNoServerConversationPersistence(operation: string): boolean {
  return !/database|postgres|supabase_db|server_storage|upload_audio/i.test(operation);
}

export function createNoStoreHeaders() {
  return {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
    "X-RQC-Storage-Policy": "browser-memory-first",
    "X-RQC-Body-Logging": "disabled"
  };
}

export function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return null;
  }
}

export function assertNoSensitiveSentinel(value: unknown, sentinels: string[]): boolean {
  const serialized = JSON.stringify(value);
  return sentinels.every((sentinel) => !serialized.includes(sentinel));
}

export type RateLimitResult =
  | {
      ok: true;
      remaining: number;
      resetAt: number;
    }
  | {
      ok: false;
      remaining: 0;
      resetAt: number;
      retryAfterSeconds: number;
    };

export type RateLimiter = {
  check(input: {
    route: string;
    userId: string;
    sessionId?: string;
    now?: number;
    forwardedFor?: string | null;
  }): RateLimitResult;
  reset(): void;
};

export function createInMemoryRateLimiter(input: {
  maxRequests: number;
  windowMs: number;
}): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  function checkBucket(key: string, now: number): RateLimitResult {
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + input.windowMs
      });
      return {
        ok: true,
        remaining: input.maxRequests - 1,
        resetAt: now + input.windowMs
      };
    }

    if (current.count >= input.maxRequests) {
      return {
        ok: false,
        remaining: 0,
        resetAt: current.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
      };
    }

    current.count += 1;
    return {
      ok: true,
      remaining: input.maxRequests - current.count,
      resetAt: current.resetAt
    };
  }

  return {
    check(request) {
      const now = request.now ?? Date.now();
      const userKey = [request.route, request.userId, "all-sessions"].join(":");
      const sessionKey = [request.route, request.userId, request.sessionId ?? "no-session"].join(":");
      const userResult = checkBucket(userKey, now);
      if (!userResult.ok) return userResult;

      const sessionResult = checkBucket(sessionKey, now);
      if (!sessionResult.ok) return sessionResult;

      return {
        ok: true,
        remaining: Math.min(userResult.remaining, sessionResult.remaining),
        resetAt: Math.max(userResult.resetAt, sessionResult.resetAt)
      };
    },
    reset() {
      buckets.clear();
    }
  };
}

export const providerRateLimiter = createInMemoryRateLimiter({
  maxRequests: 30,
  windowMs: 60_000
});
