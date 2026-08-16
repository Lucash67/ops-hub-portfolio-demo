import { NextRequest, NextResponse } from "next/server";
import { isAllBusinesses } from "@/lib/business-units";
import { buildOperationalDayMetrics } from "@/lib/operational-day-metrics";
import { generateDiaryAutoInsights } from "@/lib/diary-auto-insights";
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

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return apiError("Informe date=yyyy-MM-dd.", 400);
      }
      if (isAllBusinesses(businessId)) {
        return apiError("Selecione uma operação específica.", 400);
      }

      const metricsMap = await buildOperationalDayMetrics(businessId);
      const day = metricsMap.get(date);
      const insights = await generateDiaryAutoInsights(businessId, date);

      return NextResponse.json({
        date,
        metrics: day ?? { date, revenue: 0, profit: 0, costs: 0, source: "sales" as const },
        insights,
      });
    });
  } catch (error) {
    console.error("Temporal day summary error:", error);
    return apiError("Erro ao carregar resumo do dia.");
  }
}
