import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request.headers);
  if (!auth.ok) return jsonError(auth.code, auth.message, auth.status);

  return jsonOk({ user: auth.user });
}
