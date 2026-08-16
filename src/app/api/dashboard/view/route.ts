import { format, parseISO } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { buildDashboardView, enrichDiaryContext } from "@/lib/dashboard-view";
import { generateDiaryAutoInsights } from "@/lib/diary-auto-insights";
import { getDiaryEntry } from "@/lib/diary-service";
import { getSmartGoalsView } from "@/lib/smart-goals-service";
import { buildOperationalDayMetrics, sortOperationalDays } from "@/lib/operational-day-metrics";
import { buildWeekPulse } from "@/lib/week-pulse";
import { buildConservativeWeekForecast } from "@/lib/conservative-week-forecast";
import { isAllBusinesses } from "@/lib/business-units";
import { listDailyPurchaseMixByDate } from "@/lib/operational-data-service";
import { fetchMetricGoals } from "@/platform/db/data-access/metrics";
import { listSalesEnriched } from "@/platform/db/repositories/sale-repository";
import type { TemporalViewContext } from "@/stores/temporal-context-store";
import { MSG, apiError } from "@/shared/api-messages";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";

function isSunday(dateKey: string): boolean {
  return parseISO(dateKey).getDay() === 0;
}

function normalizeDashboardSales(
  sales: Awaited<ReturnType<typeof listSalesEnriched>>,
) {
  return sales.map((sale) => ({
    ...sale,
    paymentMethod: sale.paymentMethod ?? "",
  }));
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      const params = request.nextUrl.searchParams;
      const businessId = scope.businessId;
      const viewMode = params.get("viewMode") === "day" ? "day" : "general";
      const viewDate = params.get("date") ?? format(new Date(), "yyyy-MM-dd");

      const context: TemporalViewContext = { mode: viewMode, viewDate };

      const [sales, goals, purchasesByDate] = await Promise.all([
        listSalesEnriched(businessId),
        fetchMetricGoals(businessId),
        listDailyPurchaseMixByDate(businessId).catch(() => ({})),
      ]);

      let dailyGoal = goals.find((g) => g.type === "daily")?.targetAmount ?? 0;
      let weeklyGoal = goals.find((g) => g.type === "weekly")?.targetAmount ?? 0;

      // Base diário-primeiro: alimenta o resumo da semana nas duas visões.
      const metricsMap = await buildOperationalDayMetrics(businessId).catch(() => null);
      const dayMetrics = metricsMap ? sortOperationalDays(metricsMap) : null;

      const weekPulseOptions = {
        goalRevenue: weeklyGoal,
        allowFallback: true as const,
        sales,
        purchasesByDate,
      };

      let diaryEntry = null;
      let autoInsights: Awaited<ReturnType<typeof generateDiaryAutoInsights>> = [];

      if (viewMode === "day" && !isAllBusinesses(businessId)) {
        const [entry, smartGoals, insights] = await Promise.all([
          getDiaryEntry(businessId, viewDate),
          getSmartGoalsView(businessId, viewDate),
          generateDiaryAutoInsights(businessId, viewDate),
        ]);
        diaryEntry = entry;
        autoInsights = insights;
        if (dailyGoal <= 0) {
          dailyGoal = smartGoals?.daily.targetRevenue ?? 0;
        }
        if (weeklyGoal <= 0) {
          weeklyGoal = smartGoals?.weekly.targetRevenue ?? 0;
        }
        const diaryContext = enrichDiaryContext(entry, smartGoals?.daily?.targetUnits);
        const data = buildDashboardView(
          normalizeDashboardSales(sales),
          context,
          0,
          dailyGoal,
          0,
          diaryContext,
          businessId,
          dayMetrics,
        );
        // Garante perdas do diário no card mesmo se o resumo vier desalinhado.
        if (data.daySummary && entry) {
          data.daySummary.losses = Math.max(
            data.daySummary.losses,
            Number(entry.quantityLost) || 0,
          );
        }
        return NextResponse.json({
          data,
          diaryEntry,
          autoInsights,
          weekPulse: dayMetrics
            ? buildWeekPulse(dayMetrics, viewDate, {
                ...weekPulseOptions,
                goalRevenue: weeklyGoal,
              })
            : null,
          conservativeWeek:
            isSunday(viewDate) && dayMetrics
              ? buildConservativeWeekForecast(dayMetrics, viewDate, businessId)
              : null,
          context: { mode: viewMode, viewDate },
        });
      }

      // Visão geral usa o diário homologado como fonte oficial de receita/lucro.
      if ((dailyGoal <= 0 || weeklyGoal <= 0) && !isAllBusinesses(businessId)) {
        const smartGoals = await getSmartGoalsView(businessId).catch(() => null);
        if (dailyGoal <= 0) dailyGoal = smartGoals?.daily.targetRevenue ?? 0;
        if (weeklyGoal <= 0) weeklyGoal = smartGoals?.weekly.targetRevenue ?? 0;
      }
      const data = buildDashboardView(
        normalizeDashboardSales(sales),
        context,
        0,
        dailyGoal,
        0,
        null,
        businessId,
        dayMetrics,
      );
      const pulseDate = viewMode === "day" ? viewDate : format(new Date(), "yyyy-MM-dd");
      return NextResponse.json({
        data,
        diaryEntry: null,
        autoInsights: [],
        weekPulse: dayMetrics
          ? buildWeekPulse(dayMetrics, pulseDate, {
              ...weekPulseOptions,
              goalRevenue: weeklyGoal,
            })
          : null,
        conservativeWeek:
          isSunday(pulseDate) && dayMetrics
            ? buildConservativeWeekForecast(
                dayMetrics,
                pulseDate,
                isAllBusinesses(businessId) ? "salgados" : businessId,
              )
            : null,
        context: { mode: viewMode, viewDate },
      });
    });
  } catch (error) {
    console.error("Dashboard view GET error:", error);
    return apiError(MSG.LOAD_DASHBOARD);
  }
}
