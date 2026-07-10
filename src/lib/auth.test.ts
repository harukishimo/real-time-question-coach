import { afterEach, describe, expect, it, vi } from "vitest";
import { canUseOwnerSettings, requireApiUser, resolveServerControlledRole } from "@/lib/auth";
import { validateOAuthCallbackUrl } from "@/lib/oauth-callback";

const supabaseAuthMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUserById: vi.fn()
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: supabaseAuthMocks.getUser,
      admin: {
        updateUserById: supabaseAuthMocks.updateUserById
      }
    }
  }))
}));

function headers(input: Record<string, string>) {
  return new Headers(input);
}

describe("auth and OAuth boundaries", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("allows local dev mock auth only when both local gates are enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_RQC_AUTH_MODE", "mock");
    vi.stubEnv("DEV_AUTH_ENABLED", "true");
    vi.stubEnv("RQC_LOCAL_RUNTIME", "true");

    const result = await requireApiUser(
      headers({
        "x-rqc-dev-user": "true",
        "x-rqc-role": "owner"
      })
    );

    expect(result).toMatchObject({
      ok: true,
      user: {
        role: "owner",
        provider: "dev_mock"
      }
    });
    if (result.ok) {
      expect(canUseOwnerSettings(result.user)).toBe(true);
    }
  });

  it("rejects malformed or client-injected roles by default", async () => {
    vi.stubEnv("NEXT_PUBLIC_RQC_AUTH_MODE", "mock");
    vi.stubEnv("DEV_AUTH_ENABLED", "true");
    vi.stubEnv("RQC_LOCAL_RUNTIME", "true");

    const result = await requireApiUser(
      headers({
        "x-rqc-dev-user": "true",
        "x-rqc-role": "admin"
      })
    );

    expect(result).toMatchObject({
      ok: false,
      status: 403,
      code: "invalid_role"
    });
  });

  it("fails closed when Supabase auth is selected but public config is invalid", async () => {
    vi.stubEnv("NEXT_PUBLIC_RQC_AUTH_MODE", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://evil.example.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_placeholder");

    const result = await requireApiUser(
      headers({
        Authorization: "Bearer test-token"
      })
    );

    expect(result).toMatchObject({
      ok: false,
      status: 403,
      code: "supabase_auth_not_configured"
    });
  });

  it("validates callback URL origin and relative next path", () => {
    expect(
      validateOAuthCallbackUrl(
        "https://app.example.test/auth/callback?code=abc&state=state-1&next=/setup",
        ["https://app.example.test"],
        "state-1"
      )
    ).toMatchObject({
      ok: true,
      next: "/setup"
    });
    expect(
      validateOAuthCallbackUrl("https://evil.example.test/auth/callback?code=abc", [
        "https://app.example.test"
      ])
    ).toMatchObject({
      ok: false,
      code: "origin_not_allowed"
    });
    expect(
      validateOAuthCallbackUrl("https://app.example.test/auth/callback?code=abc&next=https://evil.example", [
        "https://app.example.test"
      ])
    ).toMatchObject({
      ok: false,
      code: "unsafe_next"
    });
    expect(
      validateOAuthCallbackUrl("https://app.example.test/auth/callback?code=abc", [
        "https://app.example.test"
      ], "state-1")
    ).toMatchObject({
      ok: false,
      code: "missing_state"
    });
    expect(
      validateOAuthCallbackUrl("https://app.example.test/auth/callback?code=abc&state=evil", [
        "https://app.example.test"
      ], "state-1")
    ).toMatchObject({
      ok: false,
      code: "state_mismatch"
    });
  });

  it("trusts only server-controlled app metadata for Supabase roles", () => {
    expect(
      resolveServerControlledRole({
        appMetadata: {},
        userMetadata: {
          role: "owner"
        }
      })
    ).toBeNull();
    expect(
      resolveServerControlledRole({
        appMetadata: {
          role: "user"
        },
        userMetadata: {
          role: "owner"
        }
      })
    ).toBe("user");
    expect(
      resolveServerControlledRole({
        appMetadata: {
          role: ["owner", "user"]
        }
      })
    ).toBeNull();
  });

  it("assigns the initial user role through server-controlled app metadata", async () => {
    vi.stubEnv("NEXT_PUBLIC_RQC_AUTH_MODE", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    supabaseAuthMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "google-user-1",
          email: "user@example.com",
          app_metadata: { provider: "google" },
          user_metadata: { role: "owner" }
        }
      },
      error: null
    });
    supabaseAuthMocks.updateUserById.mockResolvedValue({
      data: {
        user: {
          id: "google-user-1",
          email: "user@example.com",
          app_metadata: { provider: "google", role: "user" }
        }
      },
      error: null
    });

    const result = await requireApiUser(
      headers({
        Authorization: "Bearer access-token"
      })
    );

    expect(result).toMatchObject({
      ok: true,
      user: {
        id: "google-user-1",
        role: "user"
      }
    });
    expect(supabaseAuthMocks.updateUserById).toHaveBeenCalledWith("google-user-1", {
      app_metadata: {
        provider: "google",
        role: "user"
      }
    });
  });
});
