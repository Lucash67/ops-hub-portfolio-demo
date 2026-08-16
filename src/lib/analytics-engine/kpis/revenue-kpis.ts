import {
  averageTicket,
  distinctOperationalDays,
  groupRevenueByField,
  percentageOf,
  sumRevenue,
} from "../aggregates";
import type { KpiDataset, RevenueKpis } from "../types";

export function computeRevenueKpis(dataset: KpiDataset): RevenueKpis {
  const total = sumRevenue(dataset.sales);
  const operationalDays = distinctOperationalDays(dataset.sales);
  const byOpMap = groupRevenueByField(dataset.sales, "businessId");

  const byOperation = Object.entries(byOpMap).map(([businessId, revenue]) => ({
    businessId,
    revenue,
    share: percentageOf(revenue, total),
  }));

  return {
    total,
    byOperation: byOperation.sort((a, b) => b.revenue - a.revenue),
    dailyAverage: operationalDays > 0 ? total / operationalDays : 0,
    operationalDays,
  };
}

/** Receita filtrada por intervalo de datas (sobre dataset já carregado). */
export function revenueInPeriod(
  dataset: KpiDataset,
  start: string,
  end: string,
): number {
  const filtered = dataset.sales.filter((s) => s.date >= start && s.date <= end);
  return sumRevenue(filtered);
}

export function averageTicketForDataset(dataset: KpiDataset): number {
  return averageTicket(sumRevenue(dataset.sales), dataset.sales.length);
}
