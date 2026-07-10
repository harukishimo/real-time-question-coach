import { NextResponse } from "next/server";
import type { ApiErrorBody } from "@/lib/types";
import { createNoStoreHeaders } from "@/lib/security";
import type { SafeProviderDiagnostic } from "@/lib/provider-diagnostics";

export function jsonOk<T>(body: T, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: createNoStoreHeaders()
  });
}

export function jsonError(
  code: string,
  message: string,
  status: 400 | 401 | 403 | 422 | 429 | 500 | 503,
  diagnostic?: SafeProviderDiagnostic
) {
  const body: ApiErrorBody & { diagnostic?: SafeProviderDiagnostic } = {
    error: {
      code,
      message
    }
  };
  if (diagnostic) {
    body.diagnostic = diagnostic;
  }

  return NextResponse.json(body, {
    status,
    headers: createNoStoreHeaders()
  });
}
