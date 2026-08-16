import { NextRequest, NextResponse } from "next/server";
import { ALL_BUSINESSES_ID } from "@/lib/business-units";
import { initializeGoalsIfEmpty } from "@/lib/goals-service";
import { MSG, apiError } from "@/shared/api-messages";
import {
  createBusiness,
  listBusinesses,
} from "@/platform/db/repositories/business-repository";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";

export async function GET() {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    const rows = await listBusinesses(auth.id);

    return NextResponse.json({
      all: { id: ALL_BUSINESSES_ID, name: "Todos" },
      units: rows.map(({ dbId: _dbId, ...unit }) => unit),
    });
  } catch (error) {
    console.error("Businesses GET error:", error);
    return apiError(MSG.LOAD_SETTINGS);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return apiError(MSG.BUSINESS_NAME_REQUIRED, 400);
    }
    if (name.length > 80) {
      return apiError("O nome da operação deve ter no máximo 80 caracteres.", 400);
    }

    const unit = await createBusiness({ ownerId: auth.id, name });

    // Re-resolve tenant after insert so slug↔UUID mapping includes the new operation.
    return await withTenantScope(auth, unit.id, async () => {
      await initializeGoalsIfEmpty(unit.id);
      const { dbId: _dbId, ...publicUnit } = unit;
      return NextResponse.json({ unit: publicUnit, success: true }, { status: 201 });
    });
  } catch (error) {
    console.error("Businesses POST error:", error);
    return apiError(MSG.CREATE_BUSINESS);
  }
}
