import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import {
  getOpenAiCredentialStatus,
  saveOpenAiCredential,
  UserProviderCredentialError
} from "@/lib/user-provider-credential";

function credentialError(error: unknown) {
  if (error instanceof UserProviderCredentialError && error.code === "not_configured") {
    return jsonError(
      "credential_storage_not_configured",
      "User credential storage is not configured for this environment.",
      422
    );
  }
  const providerCode =
    error instanceof UserProviderCredentialError ? error.providerCode : undefined;
  return jsonError(
    "credential_operation_failed",
    providerCode
      ? `Credential operation could not be completed. Provider error code: ${providerCode}.`
      : "Credential operation could not be completed.",
    422
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request.headers);
  if (!auth.ok) return jsonError(auth.code, auth.message, auth.status);

  try {
    const credential = await getOpenAiCredentialStatus({ userId: auth.user.id });
    return jsonOk({ provider: "openai", ...credential });
  } catch (error) {
    return credentialError(error);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiUser(request.headers);
  if (!auth.ok) return jsonError(auth.code, auth.message, auth.status);

  const body = (await request.json().catch(() => null)) as unknown;
  const apiKey =
    body && typeof body === "object" && typeof (body as { apiKey?: unknown }).apiKey === "string"
      ? (body as { apiKey: string }).apiKey
      : null;
  if (!apiKey) {
    return jsonError("invalid_credential", "An OpenAI API key is required.", 422);
  }

  try {
    const credential = await saveOpenAiCredential({ userId: auth.user.id, apiKey });
    return jsonOk({ provider: "openai", ...credential });
  } catch (error) {
    return credentialError(error);
  }
}
