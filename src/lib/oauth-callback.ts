export type OAuthCallbackValidation =
  | {
      ok: true;
      code: string;
      next: string;
      origin: string;
    }
  | {
      ok: false;
      code:
        | "missing_code"
        | "missing_state"
        | "state_mismatch"
        | "unsafe_next"
        | "origin_not_allowed"
        | "malformed_url";
      next: "/";
      origin: string | null;
    };

export function validateOAuthCallbackUrl(
  rawUrl: string,
  allowedOrigins: string[],
  expectedState?: string
): OAuthCallbackValidation {
  try {
    const url = new URL(rawUrl);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const next = url.searchParams.get("next") ?? "/";

    if (!allowedOrigins.includes(url.origin)) {
      return {
        ok: false,
        code: "origin_not_allowed",
        next: "/",
        origin: url.origin
      };
    }

    if (!code) {
      return {
        ok: false,
        code: "missing_code",
        next: "/",
        origin: url.origin
      };
    }

    if (expectedState && !state) {
      return {
        ok: false,
        code: "missing_state",
        next: "/",
        origin: url.origin
      };
    }

    if (expectedState && state !== expectedState) {
      return {
        ok: false,
        code: "state_mismatch",
        next: "/",
        origin: url.origin
      };
    }

    if (!next.startsWith("/") || next.startsWith("//")) {
      return {
        ok: false,
        code: "unsafe_next",
        next: "/",
        origin: url.origin
      };
    }

    return {
      ok: true,
      code,
      next,
      origin: url.origin
    };
  } catch {
    return {
      ok: false,
      code: "malformed_url",
      next: "/",
      origin: null
    };
  }
}
