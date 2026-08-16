import { NextResponse } from "next/server";
import { buildVisaoGeralPayload } from "@/lib/visao-geral-service";
import { MSG, apiError } from "@/shared/api-messages";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { listBusinesses } from "@/platform/db/repositories/business-repository";

export async function GET() {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;

  try {
    const rows = await listBusinesses(auth.id);
    const units = rows.map(({ dbId: _dbId, ...unit }) => unit);
    const payload = await buildVisaoGeralPayload(units);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Visão Geral GET error:", error);
    return apiError(MSG.LOAD_SETTINGS);
  }
}
