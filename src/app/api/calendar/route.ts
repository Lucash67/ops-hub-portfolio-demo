import { NextRequest, NextResponse } from "next/server";
import { getCalendarData, getDayReport } from "@/lib/analytics";
import { buildOperationalDayMetrics } from "@/lib/operational-day-metrics";
import { MSG, apiError } from "@/shared/api-messages";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      const { searchParams } = request.nextUrl;
      const businessId = scope.businessId;
      const year = Number(searchParams.get("year") ?? new Date().getFullYear());
      const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);
      const date = searchParams.get("date");

      if (date) {
        const [report, metricsMap] = await Promise.all([
          getDayReport(date, businessId),
          buildOperationalDayMetrics(businessId).catch(() => null),
        ]);
        const diaryDay = metricsMap?.get(date);
        return NextResponse.json({
          ...report,
          // Diário homologado sobrescreve receita/lucro do dia.
          revenue: diaryDay?.revenue ?? report.revenue,
          profit: diaryDay?.profit ?? report.profit,
          itemsSold: diaryDay?.units ?? report.itemsSold,
        });
      }

      const calendar = await getCalendarData(year, month, businessId);
      return NextResponse.json(calendar);
    });
  } catch (error) {
    console.error("Calendar GET error:", error);
    return apiError(MSG.LOAD_CALENDAR);
  }
}
