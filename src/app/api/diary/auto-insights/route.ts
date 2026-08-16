import { NextRequest, NextResponse } from "next/server";
import { isAllBusinesses } from "@/lib/business-units";
import { generateDiaryAutoInsights, generateRecentDiaryInsights } from "@/lib/diary-auto-insights";
import { apiError } from "@/shared/api-messages";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      const params = request.nextUrl.searchParams;
      const businessId = scope.businessId;
      const date = params.get("date");

      if (isAllBusinesses(businessId)) {
        return apiError("Selecione uma operação específica.", 400);
      }

      if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return apiError("Data inválida.", 400);
        }
        const insights = await generateDiaryAutoInsights(businessId, date);
        return NextResponse.json(insights);
      }

      const insights = await generateRecentDiaryInsights(businessId, 5);
      return NextResponse.json(insights);
    });
  } catch (error) {
    console.error("Diary auto-insights error:", error);
    return apiError("Erro ao gerar insights automáticos.");
  }
}
