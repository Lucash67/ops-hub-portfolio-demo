import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  parseISO,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { fetchMetricSaleItems, fetchMetricSales, fetchMetricGoals } from "@/platform/db/data-access/metrics";
import { buildOperationalDayMetrics } from "@/lib/operational-day-metrics";
import {
  countOperationalDaysInRange,
  isOperationalDay,
} from "@/lib/operational-calendar";
import { getMonthRange, getWeekRange } from "@/lib/utils";
import { ALL_BUSINESSES_ID, isAllBusinesses } from "@/lib/business-units";

export type PeriodProjectionPeriod = "weekly" | "monthly" | "bimonthly" | "quarterly";

export type ProjectionScenarioKey = "conservador" | "base" | "otimista";

export interface PeriodProjectionMetric {
  revenue: number;
  profit: number;
  units: number;
}

export interface ProjectionScenarioSlice extends PeriodProjectionMetric {
  label: string;
  premise: string;
  dailyPace: PeriodProjectionMetric;
}

export interface ProjectionCycleClose {
  justClosed: boolean;
  label: string;
  period: "weekly" | "monthly";
  offset: -1;
  cycleKey: string;
  actual: PeriodProjectionMetric;
  projected: PeriodProjectionMetric;
  href: string;
}

export interface PeriodProjectionView {
  period: PeriodProjectionPeriod;
  periodLabel: string;
  range: { start: string; end: string };
  referenceDate: string;
  isCurrentPeriod: boolean;
  businessId: string;
  operationalDays: {
    total: number;
    elapsed: number;
    remaining: number;
  };
  actual: PeriodProjectionMetric & { margin: number };
  projected: PeriodProjectionMetric;
  goal: {
    revenue: number;
    units: number | null;
    source: "goals" | "none";
  };
  pace: PeriodProjectionMetric;
  gap: {
    revenueToProjection: number;
    profitToProjection: number;
    unitsToProjection: number;
    revenueToGoal: number;
    unitsToGoal: number;
    requiredDailyRevenueToProjection: number;
    requiredDailyUnitsToProjection: number;
    requiredDailyRevenueToGoal: number;
    requiredDailyUnitsToGoal: number;
  };
  comparison: Array<{
    label: string;
    actual: number;
    projected: number;
    goal: number;
  }>;
  dailyChart: Array<{
    label: string;
    value: number;
    revenue: number;
    profit: number;
    units: number;
  }>;
  scenarios: Record<ProjectionScenarioKey, ProjectionScenarioSlice>;
  recommendedScenario: ProjectionScenarioKey;
  cycleClose?: ProjectionCycleClose;
  insight: string;
}

const PERIOD_MONTH_SPAN: Record<PeriodProjectionPeriod, number> = {
  weekly: 0,
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function calendarBusinessId(businessId: string): string {
  return isAllBusinesses(businessId) ? "salgados" : businessId;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function monthsSpan(period: PeriodProjectionPeriod): number {
  return PERIOD_MONTH_SPAN[period] || 1;
}

export function resolveRange(
  period: PeriodProjectionPeriod,
  offset: number,
  reference = new Date(),
): { start: string; end: string } {
  if (period === "weekly") {
    return getWeekRange(addWeeks(reference, offset));
  }
  const span = monthsSpan(period);
  // offset −1 = bloco anterior de N meses
  const endAnchor = addMonths(startOfMonth(reference), offset * span);
  const end = endOfMonth(addMonths(endAnchor, span - 1));
  const start = startOfMonth(addMonths(end, -(span - 1)));
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
  };
}

function formatPeriodLabel(
  period: PeriodProjectionPeriod,
  range: { start: string; end: string },
): string {
  const start = parseISO(range.start);
  const end = parseISO(range.end);
  if (period === "weekly") {
    return `${format(start, "dd MMM", { locale: ptBR })} – ${format(end, "dd MMM yyyy", { locale: ptBR })}`;
  }
  if (period === "monthly") {
    return format(start, "MMMM yyyy", { locale: ptBR });
  }
  if (period === "bimonthly") {
    return `${format(start, "MMM", { locale: ptBR })} – ${format(end, "MMM yyyy", { locale: ptBR })}`;
  }
  return `${format(start, "MMM", { locale: ptBR })} – ${format(end, "MMM yyyy", { locale: ptBR })} (trimestre)`;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

interface DayPoint {
  date: string;
  revenue: number;
  profit: number;
  units: number;
}

function buildScenarios(
  points: DayPoint[],
  totalOpDays: number,
  baseProjected: PeriodProjectionMetric,
  basePace: PeriodProjectionMetric,
): Record<ProjectionScenarioKey, ProjectionScenarioSlice> {
  const revenues = points.map((p) => p.revenue);
  const profits = points.map((p) => p.profit);
  const units = points.map((p) => p.units);

  const avgRev = average(revenues);
  const avgProfit = average(profits);
  const avgUnits = average(units);

  const recent = points.slice(-Math.min(5, points.length));
  const recentRev = average(recent.map((p) => p.revenue));
  const recentProfit = average(recent.map((p) => p.profit));
  const recentUnits = average(recent.map((p) => p.units));

  const firstHalf = points.slice(0, Math.max(1, Math.floor(points.length / 2)));
  const secondHalf = points.slice(Math.floor(points.length / 2));
  const trend =
    average(firstHalf.map((p) => p.profit)) > 0
      ? (average(secondHalf.map((p) => p.profit)) - average(firstHalf.map((p) => p.profit))) /
        Math.max(1, average(firstHalf.map((p) => p.profit)))
      : 0;
  const growth = Math.max(0, Math.min(0.15, trend));

  const conservadorDays = Math.max(1, totalOpDays - 1);
  const safeMin = (a: number, b: number) => {
    if (!Number.isFinite(a) || a <= 0) return Math.max(0, b);
    if (!Number.isFinite(b) || b <= 0) return Math.max(0, a);
    return Math.min(a, b);
  };
  const conservadorPace = {
    revenue: round2(safeMin(avgRev, recentRev) * 0.9),
    profit: round2(safeMin(avgProfit, recentProfit) * 0.9),
    units: round2(safeMin(avgUnits, recentUnits) * 0.9),
  };

  const otimistaPace = {
    revenue: round2(Math.max(avgRev, recentRev) * (1 + growth)),
    profit: round2(Math.max(avgProfit, recentProfit) * (1 + growth)),
    units: round2(Math.max(avgUnits, recentUnits) * (1 + growth)),
  };

  // Se não há histórico suficiente, cenários colapsam na base
  const hasHistory = points.length >= 2;

  return {
    conservador: {
      label: "Conservador",
      premise: hasHistory
        ? "Ritmo 10% abaixo do pior indicador (média ou dias recentes) e 1 dia útil a menos."
        : "Poucos dias no período — usa o ritmo atual com margem de segurança.",
      dailyPace: hasHistory ? conservadorPace : {
        revenue: round2(basePace.revenue * 0.9),
        profit: round2(basePace.profit * 0.9),
        units: round2(basePace.units * 0.9),
      },
      revenue: hasHistory
        ? round2(conservadorPace.revenue * conservadorDays)
        : round2(baseProjected.revenue * 0.9),
      profit: hasHistory
        ? round2(conservadorPace.profit * conservadorDays)
        : round2(baseProjected.profit * 0.9),
      units: hasHistory
        ? Math.round(conservadorPace.units * conservadorDays)
        : Math.round(baseProjected.units * 0.9),
    },
    base: {
      label: "Base",
      premise: "Ritmo atual do período × dias úteis totais (projeção principal).",
      dailyPace: basePace,
      ...baseProjected,
    },
    otimista: {
      label: "Otimista",
      premise: hasHistory
        ? `Melhor ritmo recente com até ${(growth * 100).toFixed(0)}% de evolução e presença cheia.`
        : "Poucos dias no período — usa o ritmo atual com leve upside.",
      dailyPace: hasHistory ? otimistaPace : {
        revenue: round2(basePace.revenue * 1.08),
        profit: round2(basePace.profit * 1.08),
        units: round2(basePace.units * 1.08),
      },
      revenue: hasHistory
        ? round2(otimistaPace.revenue * totalOpDays)
        : round2(baseProjected.revenue * 1.08),
      profit: hasHistory
        ? round2(otimistaPace.profit * totalOpDays)
        : round2(baseProjected.profit * 1.08),
      units: hasHistory
        ? Math.round(otimistaPace.units * totalOpDays)
        : Math.round(baseProjected.units * 1.08),
    },
  };
}

function buildInsight(
  view: Omit<PeriodProjectionView, "insight">,
): string {
  const { actual, goal, gap, operationalDays, isCurrentPeriod, scenarios, recommendedScenario } =
    view;

  if (operationalDays.elapsed === 0) {
    return "Ainda não há dias operacionais neste período — a projeção começa quando houver o primeiro registro.";
  }

  if (!isCurrentPeriod) {
    const base = scenarios.base;
    const hitGoal = goal.revenue > 0 && actual.revenue >= goal.revenue;
    const vsBase =
      base.revenue > 0 ? round2((actual.revenue / base.revenue) * 100) : 0;
    if (hitGoal) {
      return `Ciclo fechado: meta atingida. Realizado ${formatMoney(actual.revenue)} (${vsBase}% da projeção Base).`;
    }
    if (actual.revenue < base.revenue && recommendedScenario === "conservador") {
      return `Ciclo fechado abaixo da Base (${formatMoney(actual.revenue)} vs ${formatMoney(base.revenue)}). Vale olhar o cenário Conservador para o próximo ciclo.`;
    }
    return `Ciclo fechado: ${formatMoney(actual.revenue)} de receita · ${actual.units} un. · lucro ${formatMoney(actual.profit)} (Base era ${formatMoney(base.revenue)}).`;
  }

  if (gap.revenueToProjection <= 0 && gap.unitsToProjection <= 0) {
    return "No ritmo atual você já cobre a projeção Base do período. Mantenha o padrão.";
  }

  if (operationalDays.remaining === 0) {
    return "Último dia operacional do período — o resultado de hoje fecha a projeção.";
  }

  const parts = [
    `Faltam ${operationalDays.remaining} dia${operationalDays.remaining > 1 ? "s" : ""} útil${operationalDays.remaining > 1 ? "eis" : ""}.`,
  ];
  if (gap.unitsToProjection > 0) {
    parts.push(
      `Para bater a projeção Base: ~${Math.ceil(gap.requiredDailyUnitsToProjection)} un./dia e ${formatMoney(gap.requiredDailyRevenueToProjection)}/dia.`,
    );
  }
  if (goal.revenue > 0 && gap.revenueToGoal > 0) {
    parts.push(`Para a meta: ${formatMoney(gap.requiredDailyRevenueToGoal)}/dia.`);
  }
  parts.push(
    `Faixa: Conservador ${formatMoney(scenarios.conservador.revenue)} · Otimista ${formatMoney(scenarios.otimista.revenue)}.`,
  );
  return parts.join(" ");
}

function detectJustClosedWindow(
  previousEnd: string,
  today: string,
  windowDays: number,
): boolean {
  const end = parseISO(previousEnd);
  const startWindow = addDays(end, 1);
  const endWindow = addDays(end, windowDays);
  const t = parseISO(today);
  return t >= startWindow && t <= endWindow;
}

async function summarizePeriod(
  businessId: string,
  period: "weekly" | "monthly",
  offset: number,
  referenceDate: string,
): Promise<{
  label: string;
  range: { start: string; end: string };
  actual: PeriodProjectionMetric;
  projected: PeriodProjectionMetric;
}> {
  const view = await getPeriodProjectionView(businessId, period, offset, referenceDate);
  return {
    label: view.periodLabel,
    range: view.range,
    actual: {
      revenue: view.actual.revenue,
      profit: view.actual.profit,
      units: view.actual.units,
    },
    projected: view.projected,
  };
}

/** Banner do Dashboard: ciclo imediatamente anterior acabou de fechar. */
export async function getProjectionCycleBanner(
  businessId: string = ALL_BUSINESSES_ID,
  referenceDate = format(new Date(), "yyyy-MM-dd"),
): Promise<ProjectionCycleClose | null> {
  const today = parseISO(referenceDate);
  const dayOfMonth = today.getDate();
  const weekday = getDay(today); // 0=dom … 1=seg

  // Semana: janela de até 3 dias após o fim (cobre segunda–quarta)
  const prevWeekRange = resolveRange("weekly", -1, today);
  const weekJustClosed =
    detectJustClosedWindow(prevWeekRange.end, referenceDate, 3) || weekday === 1;

  if (weekJustClosed) {
    const summary = await summarizePeriod(businessId, "weekly", -1, referenceDate);
    if (summary.actual.units > 0 || summary.actual.revenue > 0) {
      return {
        justClosed: true,
        label: summary.label,
        period: "weekly",
        offset: -1,
        cycleKey: `weekly:${summary.range.start}:${summary.range.end}`,
        actual: summary.actual,
        projected: summary.projected,
        href: `/projecoes?period=weekly&offset=-1&scenario=base`,
      };
    }
  }

  // Mês: dias 1–3 do mês novo
  if (dayOfMonth >= 1 && dayOfMonth <= 3) {
    const summary = await summarizePeriod(businessId, "monthly", -1, referenceDate);
    if (summary.actual.units > 0 || summary.actual.revenue > 0) {
      return {
        justClosed: true,
        label: summary.label,
        period: "monthly",
        offset: -1,
        cycleKey: `monthly:${summary.range.start}:${summary.range.end}`,
        actual: summary.actual,
        projected: summary.projected,
        href: `/projecoes?period=monthly&offset=-1&scenario=base`,
      };
    }
  }

  return null;
}

export async function getPeriodProjectionView(
  businessId: string = ALL_BUSINESSES_ID,
  period: PeriodProjectionPeriod = "weekly",
  offset = 0,
  referenceDate = format(new Date(), "yyyy-MM-dd"),
): Promise<PeriodProjectionView> {
  const calId = calendarBusinessId(businessId);
  const today = referenceDate;
  const range = resolveRange(period, offset, parseISO(today));
  const effectiveEnd = range.end < today ? range.end : today;
  const isCurrentPeriod = offset === 0 && range.start <= today && today <= range.end;

  const [dayMetrics, sales, goals] = await Promise.all([
    buildOperationalDayMetrics(businessId),
    fetchMetricSales({ businessId, dateGte: range.start, dateLte: range.end }),
    fetchMetricGoals(businessId),
  ]);

  const saleIds = sales.map((s) => s.id).filter((id): id is string => Boolean(id));
  const items = saleIds.length > 0 ? await fetchMetricSaleItems(saleIds) : [];
  const unitsBySale = new Map<string, number>();
  for (const item of items) {
    if (!item.saleId) continue;
    unitsBySale.set(item.saleId, (unitsBySale.get(item.saleId) ?? 0) + item.quantity);
  }

  const unitsByDate = new Map<string, number>();
  for (const sale of sales) {
    if (!isOperationalDay(sale.date, calId)) continue;
    const saleUnits = sale.id ? (unitsBySale.get(sale.id) ?? 0) : 0;
    unitsByDate.set(sale.date, (unitsByDate.get(sale.date) ?? 0) + saleUnits);
  }

  for (const [date, metrics] of Array.from(dayMetrics.entries())) {
    if (metrics.source === "diary" && typeof metrics.units === "number" && metrics.units > 0) {
      unitsByDate.set(date, metrics.units);
    }
  }

  let actualRevenue = 0;
  let actualProfit = 0;
  let actualUnits = 0;
  const points: DayPoint[] = [];

  const elapsedDays = eachDayOfInterval({
    start: parseISO(range.start),
    end: parseISO(effectiveEnd),
  });

  for (const day of elapsedDays) {
    const key = format(day, "yyyy-MM-dd");
    if (!isOperationalDay(key, calId)) continue;
    const metrics = dayMetrics.get(key);
    const revenue = metrics?.revenue ?? 0;
    const profit = metrics?.profit ?? 0;
    const units = unitsByDate.get(key) ?? 0;
    actualRevenue += revenue;
    actualProfit += profit;
    actualUnits += units;
    if (revenue > 0 || profit > 0 || units > 0) {
      points.push({ date: key, revenue, profit, units });
    }
  }

  const totalOpDays = countOperationalDaysInRange(range.start, range.end, calId);
  const elapsedOpDays = countOperationalDaysInRange(range.start, effectiveEnd, calId);
  const remainingOpDays = isCurrentPeriod
    ? countOperationalDaysInRange(today, range.end, calId)
    : 0;

  const paceRevenue = elapsedOpDays > 0 ? actualRevenue / elapsedOpDays : 0;
  const paceProfit = elapsedOpDays > 0 ? actualProfit / elapsedOpDays : 0;
  const paceUnits = elapsedOpDays > 0 ? actualUnits / elapsedOpDays : 0;

  const projectedRevenue = round2(paceRevenue * totalOpDays);
  const projectedProfit = round2(paceProfit * totalOpDays);
  const projectedUnits = Math.round(paceUnits * totalOpDays);

  const basePace = {
    revenue: round2(paceRevenue),
    profit: round2(paceProfit),
    units: round2(paceUnits),
  };
  const baseProjected = {
    revenue: projectedRevenue,
    profit: projectedProfit,
    units: projectedUnits,
  };

  const scenarios = buildScenarios(points, totalOpDays, baseProjected, basePace);

  // Metas: semanal / mensal; períodos longos = mensal × N
  const goalType = period === "weekly" ? "weekly" : "monthly";
  const goalRow = goals.find((g) => g.type === goalType);
  let goalRevenue = goalRow?.targetAmount ?? 0;
  let goalUnits = goalRow?.targetUnits ?? null;
  const span = monthsSpan(period);
  if (period === "bimonthly" || period === "quarterly") {
    if (goalRevenue > 0) goalRevenue = round2(goalRevenue * span);
    if (goalUnits != null) goalUnits = goalUnits * span;
  }

  if (goalRevenue <= 0 && goalUnits == null && !isAllBusinesses(businessId)) {
    const { getSmartGoalsView } = await import("./smart-goals-service");
    const smart = await getSmartGoalsView(businessId).catch(() => null);
    const smartPeriod = period === "weekly" ? smart?.weekly : smart?.monthly;
    if (smartPeriod) {
      goalRevenue = smartPeriod.targetRevenue * (period === "weekly" ? 1 : span || 1);
      goalUnits =
        smartPeriod.targetUnits != null
          ? smartPeriod.targetUnits * (period === "weekly" ? 1 : span || 1)
          : null;
    }
  }

  // Gap vs projeção Base (cenário padrão da API; UI pode recalcular no cliente)
  const revenueToProjection = Math.max(0, round2(projectedRevenue - actualRevenue));
  const profitToProjection = Math.max(0, round2(projectedProfit - actualProfit));
  const unitsToProjection = Math.max(0, projectedUnits - actualUnits);
  const revenueToGoal = Math.max(0, round2(goalRevenue - actualRevenue));
  const unitsToGoal = goalUnits != null ? Math.max(0, goalUnits - actualUnits) : 0;

  const div = (n: number) => (remainingOpDays > 0 ? n / remainingOpDays : n);

  const dailyChart = eachDayOfInterval({
    start: parseISO(range.start),
    end: parseISO(range.end),
  })
    .filter((d) => isOperationalDay(format(d, "yyyy-MM-dd"), calId))
    .map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const metrics = dayMetrics.get(key);
      const units = unitsByDate.get(key) ?? 0;
      const revenue = metrics?.revenue ?? 0;
      const profit = metrics?.profit ?? 0;
      return {
        label: format(d, period === "weekly" || period === "monthly" ? "dd/MM" : "dd/MM"),
        value: revenue,
        revenue,
        profit,
        units,
      };
    });

  let recommendedScenario: ProjectionScenarioKey = "base";
  if (!isCurrentPeriod && actualRevenue > 0 && actualRevenue < projectedRevenue * 0.92) {
    recommendedScenario = "conservador";
  }

  const base = {
    period,
    periodLabel: formatPeriodLabel(period, range),
    range,
    referenceDate: today,
    isCurrentPeriod,
    businessId,
    operationalDays: {
      total: totalOpDays,
      elapsed: elapsedOpDays,
      remaining: remainingOpDays,
    },
    actual: {
      revenue: round2(actualRevenue),
      profit: round2(actualProfit),
      units: actualUnits,
      margin: actualRevenue > 0 ? round2((actualProfit / actualRevenue) * 100) : 0,
    },
    projected: baseProjected,
    goal: {
      revenue: goalRevenue,
      units: goalUnits,
      source: goalRevenue > 0 || goalUnits != null ? ("goals" as const) : ("none" as const),
    },
    pace: basePace,
    gap: {
      revenueToProjection,
      profitToProjection,
      unitsToProjection,
      revenueToGoal,
      unitsToGoal,
      requiredDailyRevenueToProjection: round2(div(revenueToProjection)),
      requiredDailyUnitsToProjection: round2(div(unitsToProjection)),
      requiredDailyRevenueToGoal: round2(div(revenueToGoal)),
      requiredDailyUnitsToGoal: round2(div(unitsToGoal)),
    },
    comparison: [
      {
        label: "Receita",
        actual: round2(actualRevenue),
        projected: projectedRevenue,
        goal: goalRevenue,
      },
      {
        label: "Lucro",
        actual: round2(actualProfit),
        projected: projectedProfit,
        goal: 0,
      },
      {
        label: "Unidades",
        actual: actualUnits,
        projected: projectedUnits,
        goal: goalUnits ?? 0,
      },
    ],
    dailyChart,
    scenarios,
    recommendedScenario,
  };

  return {
    ...base,
    insight: buildInsight(base),
  };
}

export { resolveRange as resolvePeriodProjectionRange };
