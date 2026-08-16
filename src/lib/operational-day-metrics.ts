import { parseISO } from "date-fns";
import { listDiaryEntries } from "@/lib/diary-service";
import { deriveDiaryTotalProfit } from "@/lib/diary/types";
import { fetchMetricSales } from "@/platform/db/data-access/metrics";
import { isOperationalDay } from "@/lib/operational-calendar";
import { isAllBusinesses } from "@/lib/business-units";
import { sumReceivedRevenue, sumProfit } from "@/lib/analytics-engine/client";
import { deriveOperationalCostBasis } from "@/lib/day-registration/operational-profit";

export interface OperationalDayMetrics {
  date: string;
  revenue: number;
  profit: number;
  costs: number;
  units?: number;
  source: "diary" | "sales";
}

function calendarScopeId(businessId: string): string {
  return isAllBusinesses(businessId) ? "salgados" : businessId;
}

/** Lucro/receita por dia — diário homologado tem prioridade sobre soma de vendas. */
export async function buildOperationalDayMetrics(
  businessId: string,
): Promise<Map<string, OperationalDayMetrics>> {
  const calId = calendarScopeId(businessId);
  const [diaryEntries, sales] = await Promise.all([
    listDiaryEntries(businessId).catch((error) => {
      console.error("buildOperationalDayMetrics diary error:", error);
      return [];
    }),
    fetchMetricSales({ businessId }),
  ]);

  const diaryByDate = new Map(diaryEntries.map((entry) => [entry.date, entry]));
  const salesByDate = new Map<string, typeof sales>();

  for (const sale of sales) {
    if (!isOperationalDay(sale.date, calId)) continue;
    const bucket = salesByDate.get(sale.date) ?? [];
    bucket.push(sale);
    salesByDate.set(sale.date, bucket);
  }

  const dates = new Set<string>([
    ...Array.from(diaryByDate.keys()),
    ...Array.from(salesByDate.keys()),
  ]);
  const metrics = new Map<string, OperationalDayMetrics>();

  for (const date of Array.from(dates)) {
    const diary = diaryByDate.get(date);
    const daySales = salesByDate.get(date) ?? [];

    if (diary) {
      const revenue = diary.revenue.received;
      const profit = deriveDiaryTotalProfit(diary);
      metrics.set(date, {
        date,
        revenue,
        profit,
        costs: deriveOperationalCostBasis(revenue, profit),
        units: diary.quantitySold,
        source: "diary",
      });
      continue;
    }

    if (daySales.length === 0) continue;

    const revenue = sumReceivedRevenue(daySales);
    const profit = sumProfit(daySales);
    metrics.set(date, {
      date,
      revenue,
      profit,
      costs: deriveOperationalCostBasis(revenue, profit),
      source: "sales",
    });
  }

  return metrics;
}

export async function sumOperationalProfit(businessId: string): Promise<number> {
  const metrics = await buildOperationalDayMetrics(businessId);
  let total = 0;
  for (const row of Array.from(metrics.values())) {
    total += row.profit;
  }
  return Math.round(total * 100) / 100;
}

export function sortOperationalDays(metrics: Map<string, OperationalDayMetrics>): OperationalDayMetrics[] {
  return Array.from(metrics.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Soma receita/lucro/custo de dias operacionais até uma data (inclusive). */
export async function sumOperationalMetricsUpToDate(
  businessId: string,
  endDate: string,
): Promise<{ revenue: number; profit: number; costs: number }> {
  const metrics = await buildOperationalDayMetrics(businessId);
  let revenue = 0;
  let profit = 0;
  let costs = 0;
  for (const row of Array.from(metrics.values())) {
    if (row.date > endDate) continue;
    revenue += row.revenue;
    profit += row.profit;
    costs += row.costs;
  }
  return { revenue, profit, costs };
}

export function parseOperationalDate(date: string): Date {
  return parseISO(date);
}
