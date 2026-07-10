import { createClient } from "@supabase/supabase-js";
import { getPublicRuntimeConfig } from "@/lib/env";

export type UserProviderCredentialStatus = {
  configured: boolean;
  updatedAt: string | null;
};

export class UserProviderCredentialError extends Error {
  constructor(public readonly code: "not_configured" | "operation_failed") {
    super(code);
  }
}

type CredentialRow = {
  configured: boolean;
  updated_at: string;
};

function serviceClient(env: NodeJS.ProcessEnv = process.env) {
  const config = getPublicRuntimeConfig(env);
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config.supabaseUrl || !serviceRoleKey) {
    throw new UserProviderCredentialError("not_configured");
  }

  return createClient(config.supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function firstRow(data: unknown): CredentialRow | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const row = data[0];
  if (!row || typeof row !== "object") return null;
  const candidate = row as Partial<CredentialRow>;
  if (candidate.configured !== true || typeof candidate.updated_at !== "string") return null;
  return {
    configured: true,
    updated_at: candidate.updated_at
  };
}

export async function getOpenAiCredentialStatus(input: {
  userId: string;
  env?: NodeJS.ProcessEnv;
}): Promise<UserProviderCredentialStatus> {
  const env = input.env ?? process.env;
  if (getPublicRuntimeConfig(env).authMode === "mock") {
    return { configured: true, updatedAt: null };
  }

  const { data, error } = await serviceClient(env).rpc("user_openai_credential_status", {
    p_user_id: input.userId
  });
  if (error) throw new UserProviderCredentialError("operation_failed");

  const row = firstRow(data);
  return row
    ? { configured: true, updatedAt: row.updated_at }
    : { configured: false, updatedAt: null };
}

export async function saveOpenAiCredential(input: {
  userId: string;
  apiKey: string;
  env?: NodeJS.ProcessEnv;
}): Promise<UserProviderCredentialStatus> {
  const apiKey = input.apiKey.trim();
  if (apiKey.length < 20 || apiKey.length > 512) {
    throw new UserProviderCredentialError("operation_failed");
  }

  const env = input.env ?? process.env;
  if (getPublicRuntimeConfig(env).authMode === "mock") {
    return { configured: true, updatedAt: null };
  }

  const { data, error } = await serviceClient(env).rpc("upsert_user_openai_credential", {
    p_user_id: input.userId,
    p_api_key: apiKey
  });
  if (error) throw new UserProviderCredentialError("operation_failed");

  const row = firstRow(data);
  if (!row) throw new UserProviderCredentialError("operation_failed");
  return { configured: true, updatedAt: row.updated_at };
}
