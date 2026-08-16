import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  format,
  parseISO,
  subMonths,
  subWeeks,
  getDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { fetchMetricSales } from "@/platform/db/data-access/metrics";
import { computePeriodMetrics } from "@/lib/analytics-engine/aggregates";
import { calcGrowth, getMonthRange, getWeekRange } from "@/lib/utils";
import { isOperationalDay, WEEKDAY_MON_FRI } from "@/lib/operational-calendar";
import {
  buildOperationalDayMetrics,
  type OperationalDayMetrics,
} from "@/lib/operational-day-metrics";
import type { ChartDataPoint } from "@/lib/analytics";

export type PerformancePeriod = "weekly" | "monthly";

export interface PerformanceView {
  period: PerformancePeriod;
  periodLabel: string;
  range: { start: string; end: string };
  metrics: {
    revenue: number;
    profit: number;
    costs: number;
    salesCount: number;
    margin: number;
    averageTicket: number;
    itemsSold: number;
  };
  comparison: {
    revenueGrowth: number;
    profitGrowth: number;
    previousRevenue: number;
    previousProfit: number;
    previousLabel: string;
  };
  dailyChart: ChartDataPoint[];
  weekdayChart: ChartDataPoint[];
}

/** Métricas diário-primeiro dentro de um intervalo de datas (inclusive). */
function metricsInRange(
  allMetrics: Map<string, OperationalDayMetrics>,
  range: { start: string; end: string },
): OperationalDayMetrics[] {
  return Array.from(allMetrics.values())
    .filter((d) => d.date >= range.start && d.date <= range.end)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function resolveRange(period: PerformancePeriod, offset: number, reference = new Date()) {
  const anchor = period === "weekly" ? addWeeks(reference, offset) : addMonths(reference, offset);
  return period === "weekly" ? getWeekRange(anchor) : getMonthRange(anchor);
}

function previousRange(period: PerformancePeriod, range: { start: string; end: string }) {
  const start = parseISO(range.start);
  if (period === "weekly") {
    const prevStart = subWeeks(start, 1);
    return getWeekRange(prevStart);
  }
  const prevStart = subMonths(start, 1);
  return getMonthRange(prevStart);
}

function formatPeriodLabel(period: PerformancePeriod, range: { start: string; end: string }): string {
  const start = parseISO(range.start);
  const end = parseISO(range.end);
  if (period === "weekly") {
    return `${format(start, "dd MMM", { locale: ptBR })} – ${format(end, "dd MMM yyyy", { locale: ptBR })}`;
  }
  return format(start, "MMMM yyyy", { locale: ptBR });
}

function buildDailyChart(
  periodMetrics: OperationalDayMetrics[],
  range: { start: string; end: string },
  businessId: string,
): ChartDataPoint[] {
  const days = eachDayOfInterval({ start: parseISO(range.start), end: parseISO(range.end) });
  const byDate = new Map(periodMetrics.map((d) => [d.date, d]));

  return days
    .filter((d) => isOperationalDay(format(d, "yyyy-MM-dd"), businessId))
    .map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const row = byDate.get(key);
      return {
        label: format(d, "dd/MM"),
        value: row?.revenue ?? 0,
        revenue: row?.revenue ?? 0,
        profit: row?.profit ?? 0,
      };
    });
}

function buildWeekdayChart(periodMetrics: OperationalDayMetrics[]): ChartDataPoint[] {
  const byDow = new Map<number, { revenue: number; profit: number }>();

  for (const day of periodMetrics) {
    const dow = getDay(parseISO(day.date));
    const current = byDow.get(dow) ?? { revenue: 0, profit: 0 };
    current.revenue += day.revenue;
    current.profit += day.profit;
    byDow.set(dow, current);
  }

  return WEEKDAY_MON_FRI.map(({ index, label }) => {
    const row = byDow.get(index) ?? { revenue: 0, profit: 0 };
    return {
      label,
      value: row.revenue,
      revenue: row.revenue,
      profit: row.profit,
    };
  });
}

export async function getPerformanceView(
  businessId: string,
  period: PerformancePeriod = "weekly",
  offset = 0,
): Promise<PerformanceView> {
  // Diário homologado é a fonte oficial de receita/lucro/custos.
  const allMetrics = await buildOperationalDayMetrics(businessId);

  let range = resolveRange(period, offset);
  // Período atual sem operação (ex.: virada de mês) — ancora no último período com dados.
  if (offset === 0 && metricsInRange(allMetrics, range).length === 0 && allMetrics.size > 0) {
    const lastDate = Array.from(allMetrics.keys()).sort().at(-1)!;
    const anchor = parseISO(`${lastDate}T12:00:00`);
    range = period === "weekly" ? getWeekRange(anchor) : getMonthRange(anchor);
  }
  const prev = previousRange(period, range);

  const sales = await fetchMetricSales({ businessId, dateGte: range.start, dateLte: range.end });

  const periodMetrics = metricsInRange(allMetrics, range);
  const prevMetrics = metricsInRange(allMetrics, prev);

  const revenue = periodMetrics.reduce((s, d) => s + d.revenue, 0);
  const profit = periodMetrics.reduce((s, d) => s + d.profit, 0);
  const costs = periodMetrics.reduce((s, d) => s + d.costs, 0);
  const previousRevenue = prevMetrics.reduce((s, d) => s + d.revenue, 0);
  const previousProfit = prevMetrics.reduce((s, d) => s + d.profit, 0);

  // Detalhe transacional (nº de vendas / ticket) continua vindo das vendas.
  const operationalSales = sales.filter((s) => isOperationalDay(s.date, businessId));
  const metricsRaw = computePeriodMetrics(operationalSales);
  const diaryUnits = periodMetrics.reduce((s, d) => s + (d.units ?? 0), 0);
  const itemsSold = diaryUnits > 0 ? diaryUnits : metricsRaw.itemsSold;

  return {
    period,
    periodLabel: formatPeriodLabel(period, range),
    range,
    metrics: {
      revenue,
      profit,
      costs,
      salesCount: metricsRaw.salesCount,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      averageTicket:
        metricsRaw.salesCount > 0 ? revenue / metricsRaw.salesCount : metricsRaw.averageTicket,
      itemsSold,
    },
    comparison: {
      revenueGrowth: calcGrowth(revenue, previousRevenue),
      profitGrowth: calcGrowth(profit, previousProfit),
      previousRevenue,
      previousProfit,
      previousLabel: formatPeriodLabel(period, prev),
    },
    dailyChart: buildDailyChart(periodMetrics, range, businessId),
    weekdayChart: buildWeekdayChart(periodMetrics),
  };
}
