"use client";

import { createClient, type Session } from "@supabase/supabase-js";
import type { AuthUser } from "@/lib/types";

type BrowserAuthConfig = {
  authMode: "mock" | "supabase";
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  configured: boolean;
};

let browserClient: ReturnType<typeof createClient> | null = null;

export function getBrowserAuthConfig(): BrowserAuthConfig {
  const authMode =
    process.env.NEXT_PUBLIC_RQC_AUTH_MODE === "supabase" ? "supabase" : "mock";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  return {
    authMode,
    supabaseUrl,
    supabaseAnonKey,
    configured: Boolean(authMode === "supabase" && supabaseUrl && supabaseAnonKey)
  };
}

export function getSupabaseBrowserClient() {
  const config = getBrowserAuthConfig();
  if (!config.configured) return null;
  if (!browserClient) {
    browserClient = createClient(config.supabaseUrl!, config.supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        persistSession: true
      }
    });
  }

  return browserClient;
}

export function callbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/auth/callback`;
}

export async function signInWithGoogleOAuth(origin: string): Promise<{
  ok: true;
} | {
  ok: false;
  message: string;
}> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase Google OAuth is not configured for this environment."
    };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl(origin)
    }
  });

  if (error) {
    return {
      ok: false,
      message: "Google OAuth could not be started."
    };
  }

  return { ok: true };
}

function authUserFromSession(session: Session): AuthUser | null {
  const role = session.user.app_metadata.role;
  if (role !== "owner" && role !== "user") return null;

  return {
    id: session.user.id,
    email: session.user.email ?? "unknown@example.local",
    role,
    provider: "google"
  };
}

export async function getCurrentSupabaseUser(): Promise<AuthUser | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  return authUserFromSession(data.session);
}

export async function getCurrentSupabaseAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signOutCurrentSession(): Promise<
  | { ok: true }
  | {
      ok: false;
      message: string;
    }
> {
  const config = getBrowserAuthConfig();
  if (config.authMode === "mock") return { ok: true };

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase logout is not configured for this environment."
    };
  }

  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    return {
      ok: false,
      message: "ログアウトに失敗しました。もう一度お試しください。"
    };
  }

  return { ok: true };
}
