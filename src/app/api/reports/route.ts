import { NextRequest, NextResponse } from "next/server";
import { getDayReport } from "@/lib/analytics";
import {
  buildOperationalDayMetrics,
  sortOperationalDays,
} from "@/lib/operational-day-metrics";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
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
      const type = searchParams.get("type") ?? "daily";
      const dateParam = searchParams.get("date");
      const today = new Date();

      // Diário homologado é a fonte oficial de receita/lucro por dia.
      const metricsMap = await buildOperationalDayMetrics(businessId);
      const operationalDays = sortOperationalDays(metricsMap);
      const lastOperationalDate = operationalDays.at(-1)?.date;

      let start: string;
      let end: string;

      switch (type) {
        case "weekly":
          start = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
          end = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
          break;
        case "monthly":
          start = format(startOfMonth(today), "yyyy-MM-dd");
          end = format(endOfMonth(today), "yyyy-MM-dd");
          break;
        case "yearly":
          start = format(startOfYear(today), "yyyy-MM-dd");
          end = format(endOfYear(today), "yyyy-MM-dd");
          break;
        default:
          // Sem data explícita, mostra o último dia operacional (não o "hoje" vazio).
          start =
            dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
              ? dateParam
              : (lastOperationalDate ?? format(today, "yyyy-MM-dd"));
          end = start;
      }

      if (type === "daily") {
        const report = await getDayReport(start, businessId);
        const diaryDay = metricsMap.get(start);
        return NextResponse.json({
          type,
          period: { start, end },
          ...report,
          // Diário sobrescreve receita/lucro quando homologado.
          revenue: diaryDay?.revenue ?? report.revenue,
          profit: diaryDay?.profit ?? report.profit,
          itemsSold: diaryDay?.units ?? report.itemsSold,
        });
      }

      // Períodos sem nenhum dia operacional caem no intervalo com dados (evita relatório zerado).
      let periodDays = operationalDays.filter((d) => d.date >= start && d.date <= end);
      if (periodDays.length === 0 && operationalDays.length > 0) {
        if (type === "weekly") {
          const lastDate = operationalDays.at(-1)!.date;
          const anchor = new Date(`${lastDate}T12:00:00`);
          start = format(startOfWeek(anchor, { weekStartsOn: 1 }), "yyyy-MM-dd");
          end = format(endOfWeek(anchor, { weekStartsOn: 1 }), "yyyy-MM-dd");
        } else if (type === "monthly") {
          const lastDate = operationalDays.at(-1)!.date;
          const anchor = new Date(`${lastDate}T12:00:00`);
          start = format(startOfMonth(anchor), "yyyy-MM-dd");
          end = format(endOfMonth(anchor), "yyyy-MM-dd");
        }
        periodDays = operationalDays.filter((d) => d.date >= start && d.date <= end);
      }

      const days: Array<Awaited<ReturnType<typeof getDayReport>>> = [];
      const productBreakdown: Record<string, number> = {};

      for (const day of periodDays) {
        const report = await getDayReport(day.date, businessId);
        for (const [name, qty] of Object.entries(report.productBreakdown ?? {})) {
          productBreakdown[name] = (productBreakdown[name] ?? 0) + qty;
        }
        days.push({
          ...report,
          revenue: day.revenue,
          profit: day.profit,
          itemsSold: day.units ?? report.itemsSold,
        });
      }

      const totalRevenue = periodDays.reduce((s, d) => s + d.revenue, 0);
      const totalProfit = periodDays.reduce((s, d) => s + d.profit, 0);
      const totalItems = days.reduce((s, d) => s + d.itemsSold, 0);
      const totalSales = days.reduce((s, d) => s + d.salesCount, 0);

      return NextResponse.json({
        type,
        period: { start, end },
        totalRevenue,
        totalProfit,
        totalItems,
        totalSales,
        averageTicket: totalSales > 0 ? totalRevenue / totalSales : 0,
        productBreakdown,
        days,
      });
    });
  } catch (error) {
    console.error("Reports GET error:", error);
    return apiError(MSG.LOAD_REPORTS);
  }
}
