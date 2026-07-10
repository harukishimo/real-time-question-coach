import { createClient } from "@supabase/supabase-js";
import { getPublicRuntimeConfig } from "@/lib/env";
import type { AuthUser, UserRole } from "@/lib/types";

const DEV_AUTH_HEADER = "x-rqc-dev-user";
const DEV_ROLE_HEADER = "x-rqc-role";

export type AuthPermission = "use_app" | "use_provider_api" | "owner_settings";

export type AuthResult =
  | {
      ok: true;
      user: AuthUser;
    }
  | {
      ok: false;
      status: 401 | 403 | 503;
      code: string;
      message: string;
    };

function normalizeRole(value: unknown): UserRole | null {
  if (value === "owner" || value === "user" || value === "dev_mock_user") return value;
  return null;
}

function roleFromMetadata(metadata: Record<string, unknown> | undefined): UserRole | null {
  if (!metadata) return null;
  return normalizeRole(metadata.role);
}

function hasExplicitAppRole(metadata: Record<string, unknown> | undefined): boolean {
  return Boolean(metadata && Object.prototype.hasOwnProperty.call(metadata, "role") && metadata.role != null);
}

export function resolveServerControlledRole(input: {
  appMetadata?: Record<string, unknown>;
  userMetadata?: Record<string, unknown>;
}): UserRole | null {
  const role = roleFromMetadata(input.appMetadata);
  if (role === "owner" || role === "user") return role;
  return null;
}

async function provisionInitialUserRole(input: {
  userId: string;
  appMetadata: Record<string, unknown> | undefined;
  supabaseUrl: string;
  env: NodeJS.ProcessEnv;
}): Promise<
  | { ok: true; role: "user" }
  | { ok: false; code: "role_provisioning_not_configured" | "role_provisioning_failed"; message: string }
> {
  if (hasExplicitAppRole(input.appMetadata)) {
    return {
      ok: false,
      code: "role_provisioning_failed",
      message: "Supabase user role is not a supported application role."
    };
  }

  const serviceRoleKey = input.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    return {
      ok: false,
      code: "role_provisioning_not_configured",
      message: "Supabase server role provisioning is not configured."
    };
  }

  try {
    const admin = createClient(input.supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const { data, error } = await admin.auth.admin.updateUserById(input.userId, {
      app_metadata: {
        ...(input.appMetadata ?? {}),
        role: "user"
      }
    });

    if (error || data.user?.app_metadata?.role !== "user") {
      return {
        ok: false,
        code: "role_provisioning_failed",
        message: "The default Supabase user role could not be assigned."
      };
    }

    return { ok: true, role: "user" };
  } catch {
    return {
      ok: false,
      code: "role_provisioning_failed",
      message: "The default Supabase user role could not be assigned."
    };
  }
}

function bearerToken(headers: Headers): string | null {
  const value = headers.get("authorization");
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export function createDevMockUser(role: UserRole = "dev_mock_user"): AuthUser {
  return {
    id: "dev-user-001",
    email: "dev.user@example.local",
    role,
    provider: "dev_mock"
  };
}

export function createGoogleOAuthPlaceholderUser(role: UserRole = "owner"): AuthUser {
  return {
    id: "google-oauth-placeholder",
    email: "owner@example.local",
    role,
    provider: "google"
  };
}

export async function requireApiUser(
  headers: Headers,
  env: NodeJS.ProcessEnv = process.env
): Promise<AuthResult> {
  const devUser = headers.get(DEV_AUTH_HEADER);
  const publicConfig = getPublicRuntimeConfig(env);
  const devAuthEnabled =
    env.DEV_AUTH_ENABLED === "true" && env.RQC_LOCAL_RUNTIME === "true";

  if (publicConfig.authMode === "mock" && devAuthEnabled && devUser === "true") {
    const role = normalizeRole(headers.get(DEV_ROLE_HEADER));
    if (!role) {
      return {
        ok: false,
        status: 403,
        code: "invalid_role",
        message: "A valid local development role is required."
      };
    }

    return {
      ok: true,
      user: createDevMockUser(role)
    };
  }

  if (publicConfig.authMode === "mock" && devUser === "true") {
    return {
      ok: false,
      status: 403,
      code: "dev_auth_disabled",
      message: "Local development auth requires DEV_AUTH_ENABLED=true and RQC_LOCAL_RUNTIME=true."
    };
  }

  if (publicConfig.authMode === "supabase") {
    if (publicConfig.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      return {
        ok: false,
        status: 403,
        code: "supabase_auth_not_configured",
        message: "Supabase Google OAuth is selected but required public auth settings are missing or invalid."
      };
    }

    const token = bearerToken(headers);
    if (!token) {
      return {
        ok: false,
        status: 401,
        code: "missing_bearer_token",
        message: "A Supabase session bearer token is required."
      };
    }

    try {
      const supabase = createClient(publicConfig.supabaseUrl!, publicConfig.supabaseAnonKey!, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data.user) {
        return {
          ok: false,
          status: 401,
          code: "invalid_supabase_session",
          message: "Supabase session could not be verified."
        };
      }

      const role = resolveServerControlledRole({
        appMetadata: data.user.app_metadata,
        userMetadata: data.user.user_metadata
      });
      if (role === "owner" || role === "user") {
        return {
          ok: true,
          user: {
            id: data.user.id,
            email: data.user.email ?? "unknown@example.local",
            role,
            provider: "google"
          }
        };
      }

      const provisioned = await provisionInitialUserRole({
        userId: data.user.id,
        appMetadata: data.user.app_metadata,
        supabaseUrl: publicConfig.supabaseUrl!,
        env
      });
      if (!provisioned.ok) {
        return {
          ok: false,
          status: provisioned.code === "role_provisioning_not_configured" ? 503 : 403,
          code: provisioned.code,
          message: provisioned.message
        };
      }

      return {
        ok: true,
        user: {
          id: data.user.id,
          email: data.user.email ?? "unknown@example.local",
          role: provisioned.role,
          provider: "google"
        }
      };
    } catch {
      return {
        ok: false,
        status: 401,
        code: "supabase_verification_failed",
        message: "Supabase session verification failed."
      };
    }
  }

  return {
    ok: false,
    status: 401,
    code: "unauthenticated",
    message: "Authentication is required."
  };
}

export function hasPermission(user: AuthUser, permission: AuthPermission): boolean {
  if (user.role === "dev_mock_user") {
    return process.env.DEV_AUTH_ENABLED === "true" && process.env.RQC_LOCAL_RUNTIME === "true";
  }

  if (permission === "owner_settings") return user.role === "owner";
  return user.role === "owner" || user.role === "user";
}

export function canUseCoachApi(user: AuthUser): boolean {
  return hasPermission(user, "use_provider_api");
}

export function canUseOwnerSettings(user: AuthUser): boolean {
  return hasPermission(user, "owner_settings");
}
