import { NextRequest } from "next/server";
import { hasPermission, requireApiUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { createSessionProfile, validateSessionSetupInput } from "@/lib/session-profile";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request.headers);
  if (!auth.ok) {
    return jsonError(auth.code, auth.message, auth.status);
  }
  if (!hasPermission(auth.user, "use_app")) {
    return jsonError("forbidden", "This user cannot create sessions.", 403);
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const setupInput =
    body && typeof body === "object" && "setupInput" in body
      ? (body as { setupInput: unknown }).setupInput
      : body;
  const validation = validateSessionSetupInput(setupInput);

  if (!validation.ok) {
    return jsonError("invalid_session_setup", validation.errors.join(", "), 422);
  }

  const sessionProfile = createSessionProfile(validation.value);

  return jsonOk({
    sessionId: sessionProfile.id,
    user: auth.user,
    sessionProfile,
    storagePolicy: {
      browserMemoryPrimary: true,
      serverConversationPersistence: false,
      serverBodyLogging: false
    }
  });
}
