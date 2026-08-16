import { NextRequest, NextResponse } from "next/server";
import {
  deleteDiaryEntry,
  getDiaryEntry,
  listDiaryEntries,
  upsertDiaryEntry,
} from "@/lib/diary-service";
import { operationalDiaryEntrySchema } from "@/lib/diary/types";
import { MSG, apiError } from "@/shared/api-messages";
import { isAllBusinesses } from "@/lib/business-units";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";
import { requireTenantBusinessWrite } from "@/lib/auth/tenant-scope";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      const { searchParams } = request.nextUrl;
      const businessId = scope.businessId;
      const date = searchParams.get("date");
      const from = searchParams.get("from") ?? undefined;
      const to = searchParams.get("to") ?? undefined;

      if (isAllBusinesses(businessId)) {
        return apiError("Selecione uma operação específica para consultar o diário.", 400);
      }

      if (date) {
        const entry = await getDiaryEntry(businessId, date);
        if (!entry) return NextResponse.json(null);
        return NextResponse.json(entry);
      }

      return NextResponse.json(await listDiaryEntries(businessId, from, to));
    });
  } catch (error) {
    console.error("Diary GET error:", error);
    return apiError(MSG.LOAD_DIARY);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    const body = await request.json();
    return await withTenantScope(auth, body.businessId, async (scope) => {
      const businessId = requireTenantBusinessWrite(scope, body.businessId);

      const parsed = operationalDiaryEntrySchema.safeParse({ ...body, businessId });
      if (!parsed.success) {
        return apiError("Dados do diário inválidos.", 400);
      }

      const result = await upsertDiaryEntry(parsed.data);
      return NextResponse.json({ success: true, id: result.id });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : MSG.SAVE_DIARY;
    console.error("Diary PUT error:", error);
    return apiError(message, message.includes("Selecione") || message.includes("operação específica") ? 400 : 500);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      const businessId = requireTenantBusinessWrite(scope, request.nextUrl.searchParams.get("businessId"));
      const date = request.nextUrl.searchParams.get("date");
      if (!date) return apiError("Informe a data.", 400);

      await deleteDiaryEntry(businessId, date);
      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error("Diary DELETE error:", error);
    if (error instanceof Error && error.message.includes("operação específica")) {
      return apiError(error.message, 400);
    }
    return apiError(MSG.SAVE_DIARY);
  }
}
