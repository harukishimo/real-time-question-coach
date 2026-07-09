import { NextRequest } from "next/server";
import { canUseCoachApi, requireApiUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getServerRuntimeConfig } from "@/lib/env";
import { publicDiagnosticSummary } from "@/lib/provider-diagnostics";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request.headers);
  if (!auth.ok) {
    return jsonError(auth.code, auth.message, auth.status);
  }
  if (!canUseCoachApi(auth.user)) {
    return jsonError("forbidden", "This user cannot view provider diagnostics.", 403);
  }

  const config = getServerRuntimeConfig();

  return jsonOk({
    authMode: config.authMode,
    providerMode: config.providerMode,
    llmProvider: config.llmProvider,
    sttProvider: config.sttProvider,
    providerReady: config.providerReady,
    missingRequiredServerKeys: config.missingRequiredServerKeys,
    diagnostics: publicDiagnosticSummary(config.diagnostics),
    storagePolicy: {
      persistedToServer: false,
      bodyLogged: false
    }
  });
}
