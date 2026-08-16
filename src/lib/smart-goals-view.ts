import {
  endOfMonth,
  format,
  getDay,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import {
  computeGrowth,
  computeGoalProgress,
  flavorQuantityBreakdown,
  saleReceivedAmount,
} from "@/lib/analytics-engine/client";
import { SALGADOS_BUSINESS_ID } from "@/lib/business-units";
import { getWeekRange, getMonthRange } from "@/lib/utils";

export type TrendDirection = "growing" | "stable" | "declining";
export type ProbabilityLevel = "high" | "medium" | "low";

export interface DayUnitsRow {
  date: string;
  units: number;
  revenue: number;
  profit: number;
}

export interface SmartGoalPeriod {
  targetUnits: number;
  targetRevenue: number;
  achievedUnits: number;
  achievedRevenue: number;
  achievedProfit: number;
  progressPercent: number;
  remainingUnits: number;
  remainingRevenue: number;
  daysRemaining: number;
  requiredDailyUnits: number;
  requiredDailyRevenue: number;
  probability: ProbabilityLevel;
  probabilityLabel: string;
  probabilityReason: string;
  trend: TrendDirection;
  trendLabel: string;
  rationale: string[];
}

export interface StreakInfo {
  current: number;
  best: number;
  currentLabel: string;
  bestLabel: string;
}

export interface ComparisonRow {
  label: string;
  current: number;
  previous: number;
  changePercent: number;
  conclusion: string;
}

export interface ProductGoalRow {
  name: string;
  target: number;
  achieved: number;
  progressPercent: number;
}

export interface HourGoalRow {
  period: "morning" | "afternoon";
  label: string;
  target: number;
  achieved: number;
  progressPercent: number;
}

export interface GoalChallenge {
  id: string;
  emoji: string;
  message: string;
}

export interface GoalRecommendation {
  id: string;
  message: string;
}

export interface SimulatorResult {
  extraUnits: number;
  projectedRevenue: number;
  projectedProfit: number;
  wouldHitDailyGoal: boolean;
  projectedTotalUnits: number;
}

export type GoalTargetSource = "manual" | "smart";

export interface GoalTargetSuggestion {
  units: number;
  revenue: number;
}

export interface EditableGoalSlot {
  id: string | null;
  type: "daily" | "weekly" | "monthly";
  configuredUnits: number | null;
  configuredAmount: number;
  effectiveUnits: number;
  effectiveAmount: number;
  suggestedUnits: number;
  suggestedAmount: number;
  source: GoalTargetSource;
}

export interface SmartGoalsView {
  businessId: string;
  referenceDate: string;
  daily: SmartGoalPeriod;
  weekly: SmartGoalPeriod;
  monthly: SmartGoalPeriod & {
    projectionRevenue: number;
    projectionProfit: number;
    previousMonthRevenue: number;
    previousMonthChangePercent: number;
  };
  /** Sempre a sugestão automática (mesmo quando a meta ativa é manual). */
  suggested: {
    daily: GoalTargetSuggestion;
    weekly: GoalTargetSuggestion;
    monthly: GoalTargetSuggestion;
  };
  /** Fonte efetiva do alvo diário (manual vence quando há cadastro > 0). */
  source: GoalTargetSource;
  editable: {
    daily: EditableGoalSlot;
    weekly: EditableGoalSlot;
    monthly: EditableGoalSlot;
  };
  streak: StreakInfo;
  comparisons: ComparisonRow[];
  productGoals: ProductGoalRow[];
  hourGoals: HourGoalRow[];
  challenges: GoalChallenge[];
  recommendations: GoalRecommendation[];
  avgUnitPrice: number;
  avgUnitProfit: number;
}

export interface StoredGoalTarget {
  id?: string;
  type: "daily" | "weekly" | "monthly" | "yearly";
  targetAmount: number;
  targetUnits?: number | null;
}

export interface SmartGoalsInput {
  businessId: string;
  referenceDate?: string;
  sales: Array<{
    id?: string;
    date: string;
    time: string;
    totalAmount: number;
    amountReceived?: number | null;
    paymentStatus?: string | null;
    profit: number;
  }>;
  items: Array<{ saleId?: string; productId: string; quantity: number }>;
  productNameById: (id: string) => string;
  avgPrice: number;
  avgCost: number;
  pendingRevenue: number;
  diaryInsights?: {
    manualInsights?: string;
    lossReason?: string;
    dailyGoalUnits?: number;
  };
  /** Métricas diário-primeiro por data — sobrescrevem os totais derivados das vendas. */
  dayMetrics?: Array<{ date: string; units?: number; revenue: number; profit: number }>;
  /** Metas cadastradas (manual). Se units/amount > 0, vencem a sugestão. */
  storedGoals?: StoredGoalTarget[];
}

function isOperationalDay(date: string, businessId: string): boolean {
  if (businessId !== SALGADOS_BUSINESS_ID) return true;
  const day = getDay(parseISO(date));
  return day !== 0 && day !== 6;
}

function unitsByDate(input: SmartGoalsInput): Map<string, DayUnitsRow> {
  const map = new Map<string, DayUnitsRow>();
  const itemsBySale = new Map<string, number>();

  for (const item of input.items) {
    if (!item.saleId) continue;
    itemsBySale.set(item.saleId, (itemsBySale.get(item.saleId) ?? 0) + item.quantity);
  }

  for (const sale of input.sales) {
    if (!isOperationalDay(sale.date, input.businessId)) continue;
    const units = sale.id ? (itemsBySale.get(sale.id) ?? 0) : 0;
    const row = map.get(sale.date) ?? { date: sale.date, units: 0, revenue: 0, profit: 0 };
    row.units += units;
    row.revenue += saleReceivedAmount(sale);
    row.profit += sale.profit;
    map.set(sale.date, row);
  }

  // Diário homologado sobrescreve os totais do dia.
  for (const day of input.dayMetrics ?? []) {
    if (!isOperationalDay(day.date, input.businessId)) continue;
    const row = map.get(day.date) ?? { date: day.date, units: 0, revenue: 0, profit: 0 };
    row.revenue = day.revenue;
    row.profit = day.profit;
    if (day.units != null && day.units > 0) row.units = day.units;
    map.set(day.date, row);
  }

  return map;
}

function sortedOperationalDays(map: Map<string, DayUnitsRow>, businessId: string): DayUnitsRow[] {
  return Array.from(map.values())
    .filter((r) => isOperationalDay(r.date, businessId))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function roundChallenge(value: number): number {
  return Math.max(1, Math.round(value));
}

export function suggestDailyTarget(
  rows: DayUnitsRow[],
  businessId: string,
  diaryGoal?: number,
): { units: number; revenue: number; rationale: string[] } {
  const rationale: string[] = [];
  const recent = rows.slice(-5);

  if (recent.length === 0) {
    const fallback = diaryGoal ?? 12;
    rationale.push("Histórico insuficiente — usando meta do Diário Operacional.");
    return { units: fallback, revenue: fallback * 5, rationale };
  }

  const avgUnits = recent.reduce((s, r) => s + r.units, 0) / recent.length;
  const avgRevenue = recent.reduce((s, r) => s + r.revenue, 0) / recent.length;

  rationale.push(
    `Média dos últimos ${recent.length} dia${recent.length > 1 ? "s" : ""} operaciona${recent.length > 1 ? "is" : "l"}: ${roundChallenge(avgUnits)} unidades.`,
  );

  let multiplier = 1.05;
  if (recent.length >= 3) {
    const lastTwo = recent.slice(-2);
    const prev = recent.slice(0, -2);
    const lastAvg = lastTwo.reduce((s, r) => s + r.units, 0) / lastTwo.length;
    const prevAvg =
      prev.length > 0 ? prev.reduce((s, r) => s + r.units, 0) / prev.length : lastAvg;
    const growth = computeGrowth(lastAvg, prevAvg);
    if (growth > 15) {
      multiplier = 1.1;
      rationale.push("Seu desempenho está crescendo.");
    } else if (growth < -10) {
      multiplier = 1.02;
      rationale.push("Desempenho recente em recuperação — meta conservadora.");
    } else {
      rationale.push("Ritmo estável — meta ligeiramente acima da média.");
    }
  }

  let suggestedUnits = roundChallenge(avgUnits * multiplier);
  const ceiling = roundChallenge(avgUnits * 1.25);
  const floor = roundChallenge(avgUnits);
  suggestedUnits = Math.min(ceiling, Math.max(floor, suggestedUnits));

  if (diaryGoal && diaryGoal > 0) {
    suggestedUnits = Math.round((suggestedUnits + diaryGoal) / 2);
    rationale.push(`Alinhado com meta do Diário (${diaryGoal} un.).`);
  }

  rationale.push(`Meta sugerida: ${suggestedUnits} unidades.`);

  return {
    units: suggestedUnits,
    revenue: Math.max(Math.round(avgRevenue * multiplier * 100) / 100, suggestedUnits * 5),
    rationale,
  };
}

export function computeProbability(
  rows: DayUnitsRow[],
  targetUnits: number,
): { level: ProbabilityLevel; label: string; reason: string } {
  if (rows.length === 0) {
    return { level: "medium", label: "Média", reason: "Histórico ainda curto para previsão precisa." };
  }

  const threshold = targetUnits * 0.9;
  const met = rows.filter((r) => r.units >= threshold).length;
  const rate = (met / rows.length) * 100;

  if (rate >= 70) {
    return {
      level: "high",
      label: "Alta",
      reason: `Você atingiu metas semelhantes em ${Math.round(rate)}% dos dias operacionais.`,
    };
  }
  if (rate >= 40) {
    return {
      level: "medium",
      label: "Média",
      reason: `Taxa de sucesso histórica de ${Math.round(rate)}% em dias comparáveis.`,
    };
  }
  return {
    level: "low",
    label: "Baixa",
    reason: `Apenas ${Math.round(rate)}% dos dias atingiram patamar semelhante.`,
  };
}

export function computeTrend(rows: DayUnitsRow[]): { trend: TrendDirection; label: string } {
  if (rows.length < 2) return { trend: "stable", label: "Estável" };
  const last3 = rows.slice(-3);
  const prev3 = rows.slice(-6, -3);
  const lastAvg = last3.reduce((s, r) => s + r.units, 0) / last3.length;
  const prevAvg =
    prev3.length > 0 ? prev3.reduce((s, r) => s + r.units, 0) / prev3.length : lastAvg;
  const growth = computeGrowth(lastAvg, prevAvg);
  if (growth >= 10) return { trend: "growing", label: "Crescendo" };
  if (growth <= -10) return { trend: "declining", label: "Caindo" };
  return { trend: "stable", label: "Estável" };
}

export function computeStreaks(rows: DayUnitsRow[], targetUnits: number): StreakInfo {
  if (rows.length === 0) {
    return {
      current: 0,
      best: 0,
      currentLabel: "Nenhuma sequência ativa",
      bestLabel: "Sem histórico",
    };
  }

  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  let current = 0;
  for (const row of sorted) {
    if (row.units >= targetUnits * 0.9) current++;
    else break;
  }

  let best = 0;
  let run = 0;
  for (const row of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
    if (row.units >= targetUnits * 0.9) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  return {
    current,
    best,
    currentLabel:
      current > 0
        ? `${current} dia${current > 1 ? "s" : ""} consecutivo${current > 1 ? "s" : ""} batendo meta`
        : "Sequência interrompida — recomece hoje",
    bestLabel:
      best > 0 ? `${best} dia${best > 1 ? "s" : ""} consecutivos (recorde)` : "Ainda sem sequência registrada",
  };
}

function parseHour(time: string): number {
  return parseInt(time.split(":")[0] ?? "0", 10);
}

function hourPeriod(hour: number): HourGoalRow["period"] {
  return hour < 13 ? "morning" : "afternoon";
}

const HOUR_LABELS: Record<HourGoalRow["period"], string> = {
  morning: "Manhã",
  afternoon: "Tarde",
};

export function buildProductGoals(
  input: SmartGoalsInput,
  dailyTarget: number,
  referenceDate: string,
): ProductGoalRow[] {
  const monthStart = format(startOfMonth(parseISO(referenceDate)), "yyyy-MM-dd");
  const monthItems = input.items.filter((item) => {
    const sale = input.sales.find((s) => s.id === item.saleId);
    return sale && sale.date >= monthStart && sale.date <= referenceDate;
  });

  const breakdown = flavorQuantityBreakdown(monthItems, input.productNameById);
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  if (total === 0) return [];

  const todayItems = input.items.filter((item) => {
    const sale = input.sales.find((s) => s.id === item.saleId);
    return sale?.date === referenceDate;
  });
  const todayBreakdown = flavorQuantityBreakdown(todayItems, input.productNameById);

  return Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([name, qty]) => {
      const share = qty / total;
      const target = Math.max(1, roundChallenge(dailyTarget * share));
      const achieved = todayBreakdown[name] ?? 0;
      return {
        name: name.split(" ")[0] ?? name,
        target,
        achieved,
        progressPercent: computeGoalProgress(achieved, target),
      };
    });
}

export function buildHourGoals(
  input: SmartGoalsInput,
  dailyTarget: number,
  referenceDate: string,
): HourGoalRow[] {
  const from = format(subDays(parseISO(referenceDate), 30), "yyyy-MM-dd");
  const monthSales = input.sales.filter((s) => s.date >= from);
  const counts: Record<HourGoalRow["period"], number> = { morning: 0, afternoon: 0 };
  const todayCounts: Record<HourGoalRow["period"], number> = { morning: 0, afternoon: 0 };

  const itemsBySale = new Map<string, number>();
  for (const item of input.items) {
    if (!item.saleId) continue;
    itemsBySale.set(item.saleId, (itemsBySale.get(item.saleId) ?? 0) + item.quantity);
  }

  for (const sale of monthSales) {
    counts[hourPeriod(parseHour(sale.time))] += itemsBySale.get(sale.id ?? "") ?? 0;
  }
  for (const sale of input.sales.filter((s) => s.date === referenceDate)) {
    todayCounts[hourPeriod(parseHour(sale.time))] += itemsBySale.get(sale.id ?? "") ?? 0;
  }

  const total = counts.morning + counts.afternoon || 1;

  return (["morning", "afternoon"] as const).map((period) => {
    const target = Math.max(1, roundChallenge(dailyTarget * (counts[period] / total)));
    const achieved = todayCounts[period];
    return {
      period,
      label: HOUR_LABELS[period],
      target,
      achieved,
      progressPercent: computeGoalProgress(achieved, target),
    };
  });
}

export function buildChallenges(
  daily: SmartGoalPeriod,
  streak: StreakInfo,
  comparisons: ComparisonRow[],
): GoalChallenge[] {
  const items: GoalChallenge[] = [];

  if (daily.remainingUnits > 0) {
    items.push({
      id: "units-gap",
      emoji: "🔥",
      message: `Venda mais ${daily.remainingUnits} unidade${daily.remainingUnits > 1 ? "s" : ""} para bater a meta.`,
    });
  }
  if (streak.best > 0 && streak.current < streak.best) {
    items.push({
      id: "beat-streak",
      emoji: "🏆",
      message: `Bata sua melhor sequência de ${streak.best} dias.`,
    });
  }
  const vsYesterday = comparisons[0];
  if (vsYesterday && vsYesterday.previous > vsYesterday.current) {
    const gap = Math.round((vsYesterday.previous - vsYesterday.current) * 100) / 100;
    items.push({
      id: "beat-yesterday",
      emoji: "🎯",
      message: `Faltam R$ ${gap.toFixed(2).replace(".", ",")} para superar ontem.`,
    });
  }
  if (daily.progressPercent >= 100) {
    items.push({ id: "done", emoji: "✅", message: "Meta do dia batida — mantenha o ritmo!" });
  }
  return items.slice(0, 3);
}

export function buildRecommendations(
  input: SmartGoalsInput,
  daily: SmartGoalPeriod,
  productGoals: ProductGoalRow[],
): GoalRecommendation[] {
  const recs: GoalRecommendation[] = [];

  const topGap = productGoals.find((p) => p.achieved < p.target);
  if (topGap) {
    const gap = topGap.target - topGap.achieved;
    recs.push({
      id: "product-extra",
      message: `Leve ${gap} ${topGap.name}${gap > 1 ? "s" : ""} extra${gap > 1 ? "s" : ""}.`,
    });
  }

  if (input.sales.length > 0) {
    recs.push({
      id: "peak-hour",
      message: "Priorize o refeitório entre 9h30 e 10h30 — pico histórico de vendas.",
    });
  } else {
    recs.push({
      id: "start-history",
      message: "Sem histórico ainda — registre as primeiras vendas para calibrar horários e metas.",
    });
  }

  if (input.pendingRevenue > 0) {
    recs.push({
      id: "collect",
      message: `Cobrar pendências aumentará sua receita recebida em R$ ${input.pendingRevenue.toFixed(2).replace(".", ",")}.`,
    });
  }

  const insights = input.diaryInsights?.manualInsights?.toLowerCase() ?? "";
  if (insights.includes("pastel esgotou")) {
    recs.push({ id: "pastel-mix", message: "Pastel esgotou rápido — aumente no mix de amanhã." });
  }
  if (insights.includes("placa") || insights.includes("preço") || insights.includes("qr")) {
    recs.push({ id: "signage", message: "Nova placa com preços visíveis pode aumentar conversão." });
  }

  if (daily.remainingUnits > 0) {
    recs.push({
      id: "focus-units",
      message: `Foco: ${daily.remainingUnits} unidades separam você da meta de hoje.`,
    });
  }

  return recs.slice(0, 5);
}

export function simulateExtraUnits(
  extraUnits: number,
  currentUnits: number,
  targetUnits: number,
  avgPrice: number,
  avgProfit: number,
): SimulatorResult {
  const projectedTotalUnits = currentUnits + extraUnits;
  return {
    extraUnits,
    projectedRevenue: Math.round(extraUnits * avgPrice * 100) / 100,
    projectedProfit: Math.round(extraUnits * avgProfit * 100) / 100,
    wouldHitDailyGoal: projectedTotalUnits >= targetUnits,
    projectedTotalUnits,
  };
}

function buildPeriod(
  targetUnits: number,
  targetRevenue: number,
  achievedUnits: number,
  achievedRevenue: number,
  achievedProfit: number,
  daysRemaining: number,
  historicalRows: DayUnitsRow[],
  rationale: string[],
): SmartGoalPeriod {
  const prob = computeProbability(historicalRows, targetUnits);
  const trend = computeTrend(historicalRows);

  return {
    targetUnits,
    targetRevenue,
    achievedUnits,
    achievedRevenue,
    achievedProfit,
    progressPercent: computeGoalProgress(achievedUnits, targetUnits),
    remainingUnits: Math.max(0, targetUnits - achievedUnits),
    remainingRevenue: Math.max(0, targetRevenue - achievedRevenue),
    daysRemaining,
    requiredDailyUnits:
      daysRemaining > 0
        ? Math.max(0, Math.ceil((targetUnits - achievedUnits) / daysRemaining))
        : Math.max(0, targetUnits - achievedUnits),
    requiredDailyRevenue:
      daysRemaining > 0
        ? Math.max(0, (targetRevenue - achievedRevenue) / daysRemaining)
        : Math.max(0, targetRevenue - achievedRevenue),
    probability: prob.level,
    probabilityLabel: prob.label,
    probabilityReason: prob.reason,
    trend: trend.trend,
    trendLabel: trend.label,
    rationale,
  };
}

function countOperationalDaysInRange(start: string, end: string, businessId: string): number {
  let count = 0;
  let cursor = parseISO(start);
  const endDate = parseISO(end);
  while (cursor <= endDate) {
    if (isOperationalDay(format(cursor, "yyyy-MM-dd"), businessId)) count++;
    cursor = subDays(cursor, -1);
  }
  return count;
}

function buildComparison(label: string, current: number, previous: number): ComparisonRow {
  const change = computeGrowth(current, previous);
  let conclusion = "Desempenho estável.";
  if (change >= 15) conclusion = "Evolução forte — mantenha o ritmo.";
  else if (change >= 5) conclusion = "Leve crescimento.";
  else if (change <= -15) conclusion = "Queda relevante — ajuste a operação.";
  else if (change <= -5) conclusion = "Leve recuo em relação ao período anterior.";

  return { label, current, previous, changePercent: change, conclusion };
}

function isManualConfigured(goal: StoredGoalTarget | undefined): boolean {
  if (!goal) return false;
  const units = goal.targetUnits ?? 0;
  const amount = goal.targetAmount ?? 0;
  return units > 0 || amount > 0;
}

function resolveManualTarget(
  goal: StoredGoalTarget | undefined,
  avgPrice: number,
): { units: number; revenue: number } | null {
  if (!isManualConfigured(goal)) return null;
  const price = avgPrice > 0 ? avgPrice : 5;
  const unitsRaw = goal?.targetUnits ?? 0;
  const amountRaw = goal?.targetAmount ?? 0;
  let units = unitsRaw > 0 ? unitsRaw : Math.max(1, Math.round(amountRaw / price));
  let revenue = amountRaw > 0 ? amountRaw : Math.round(units * price * 100) / 100;
  return { units, revenue };
}

function buildEditableSlot(
  type: "daily" | "weekly" | "monthly",
  stored: StoredGoalTarget | undefined,
  suggested: GoalTargetSuggestion,
  effective: GoalTargetSuggestion,
  source: GoalTargetSource,
): EditableGoalSlot {
  return {
    id: stored?.id ?? null,
    type,
    configuredUnits: stored?.targetUnits ?? null,
    configuredAmount: stored?.targetAmount ?? 0,
    effectiveUnits: effective.units,
    effectiveAmount: effective.revenue,
    suggestedUnits: suggested.units,
    suggestedAmount: suggested.revenue,
    source,
  };
}

export function buildSmartGoalsView(input: SmartGoalsInput): SmartGoalsView {
  const referenceDate = input.referenceDate ?? format(new Date(), "yyyy-MM-dd");
  const dayMap = unitsByDate(input);
  const allDays = sortedOperationalDays(dayMap, input.businessId);
  const avgUnitPrice = input.avgPrice > 0 ? input.avgPrice : 5;
  const avgUnitProfit = avgUnitPrice - (input.avgCost > 0 ? input.avgCost : 3.75);

  const dailySuggestion = suggestDailyTarget(
    allDays.filter((d) => d.date < referenceDate),
    input.businessId,
    input.diaryInsights?.dailyGoalUnits,
  );

  const storedByType = new Map(
    (input.storedGoals ?? []).map((g) => [g.type, g] as const),
  );
  const storedDaily = storedByType.get("daily");
  const storedWeekly = storedByType.get("weekly");
  const storedMonthly = storedByType.get("monthly");

  const todayRow = dayMap.get(referenceDate) ?? { date: referenceDate, units: 0, revenue: 0, profit: 0 };

  const anchor = parseISO(referenceDate);
  const { start: weekStart, end: weekEnd } = getWeekRange(anchor);
  const weekDays = allDays.filter((d) => d.date >= weekStart && d.date <= referenceDate);
  const weekUnits = weekDays.reduce((s, r) => s + r.units, 0);
  const weekRevenue = weekDays.reduce((s, r) => s + r.revenue, 0);
  const weekProfit = weekDays.reduce((s, r) => s + r.profit, 0);
  const operationalDaysLeft = countOperationalDaysInRange(referenceDate, weekEnd, input.businessId);
  const weekOpDays = Math.max(1, weekDays.length + operationalDaysLeft);

  const suggestedDaily: GoalTargetSuggestion = {
    units: dailySuggestion.units,
    revenue: dailySuggestion.revenue,
  };
  const suggestedWeekly: GoalTargetSuggestion = {
    units: dailySuggestion.units * weekOpDays,
    revenue: Math.round(dailySuggestion.revenue * weekOpDays * 100) / 100,
  };

  const { start: monthStart } = getMonthRange(anchor);
  const monthEnd = format(endOfMonth(anchor), "yyyy-MM-dd");
  const monthDays = allDays.filter((d) => d.date >= monthStart && d.date <= referenceDate);
  const monthUnits = monthDays.reduce((s, r) => s + r.units, 0);
  const monthRevenue = monthDays.reduce((s, r) => s + r.revenue, 0);
  const monthProfit = monthDays.reduce((s, r) => s + r.profit, 0);
  const operationalDaysInMonth = countOperationalDaysInRange(monthStart, monthEnd, input.businessId);
  const operationalDaysElapsed = countOperationalDaysInRange(monthStart, referenceDate, input.businessId);
  const operationalDaysLeftMonth = operationalDaysInMonth - operationalDaysElapsed;

  const suggestedMonthly: GoalTargetSuggestion = {
    units: dailySuggestion.units * operationalDaysInMonth,
    revenue: Math.round(dailySuggestion.revenue * operationalDaysInMonth * 100) / 100,
  };

  const manualDaily = resolveManualTarget(storedDaily, avgUnitPrice);
  const manualWeekly = resolveManualTarget(storedWeekly, avgUnitPrice);
  const manualMonthly = resolveManualTarget(storedMonthly, avgUnitPrice);

  const dailySource: GoalTargetSource = manualDaily ? "manual" : "smart";
  const weeklySource: GoalTargetSource = manualWeekly ? "manual" : "smart";
  const monthlySource: GoalTargetSource = manualMonthly ? "manual" : "smart";

  // Semanal/mensal sem cadastro próprio herdam da diária efetiva quando a diária é manual.
  const effectiveDaily = manualDaily ?? suggestedDaily;
  const effectiveWeekly =
    manualWeekly ??
    (dailySource === "manual"
      ? {
          units: effectiveDaily.units * weekOpDays,
          revenue: Math.round(effectiveDaily.revenue * weekOpDays * 100) / 100,
        }
      : suggestedWeekly);
  const effectiveMonthly =
    manualMonthly ??
    (dailySource === "manual"
      ? {
          units: effectiveDaily.units * operationalDaysInMonth,
          revenue: Math.round(effectiveDaily.revenue * operationalDaysInMonth * 100) / 100,
        }
      : suggestedMonthly);

  const dailyRationale =
    dailySource === "manual"
      ? [
          "Meta manual ativa — definida por você em Metas ou Configurações.",
          `Sugestão automática atual: ${suggestedDaily.units} un. / R$ ${suggestedDaily.revenue.toFixed(2)}.`,
        ]
      : dailySuggestion.rationale;

  const weeklyRationale =
    weeklySource === "manual"
      ? [
          "Meta semanal manual ativa.",
          `Sugestão automática: ${suggestedWeekly.units} un.`,
        ]
      : dailySource === "manual"
        ? [`Meta semanal = sua meta diária (${effectiveDaily.units}) × ${weekOpDays} dias úteis.`]
        : [`Meta semanal = meta diária × dias úteis (${weekOpDays}).`];

  const monthlyRationale =
    monthlySource === "manual"
      ? [
          "Meta mensal manual ativa.",
          `Sugestão automática: ${suggestedMonthly.units} un.`,
        ]
      : dailySource === "manual"
        ? [`Projeção: sua meta diária (${effectiveDaily.units}) × ${operationalDaysInMonth} dias úteis.`]
        : [`Projeção: ${suggestedDaily.units} un./dia × ${operationalDaysInMonth} dias úteis.`];

  const daily = buildPeriod(
    effectiveDaily.units,
    effectiveDaily.revenue,
    todayRow.units,
    todayRow.revenue,
    todayRow.profit,
    0,
    allDays,
    dailyRationale,
  );

  const weekly = buildPeriod(
    effectiveWeekly.units,
    effectiveWeekly.revenue,
    weekUnits,
    weekRevenue,
    weekProfit,
    operationalDaysLeft,
    allDays,
    weeklyRationale,
  );

  const monthlyBase = buildPeriod(
    effectiveMonthly.units,
    effectiveMonthly.revenue,
    monthUnits,
    monthRevenue,
    monthProfit,
    operationalDaysLeftMonth,
    allDays,
    monthlyRationale,
  );

  const prevMonthStart = format(startOfMonth(subMonths(anchor, 1)), "yyyy-MM-dd");
  const prevMonthEnd = format(endOfMonth(subMonths(anchor, 1)), "yyyy-MM-dd");
  const prevMonthRevenue = allDays
    .filter((d) => d.date >= prevMonthStart && d.date <= prevMonthEnd)
    .reduce((s, r) => s + r.revenue, 0);

  const paceRevenue = operationalDaysElapsed > 0 ? monthRevenue / operationalDaysElapsed : 0;
  const paceProfit = operationalDaysElapsed > 0 ? monthProfit / operationalDaysElapsed : 0;

  const streak = computeStreaks(allDays, effectiveDaily.units);

  const yesterday = format(subDays(anchor, 1), "yyyy-MM-dd");
  const prevWeekStart = format(subDays(parseISO(weekStart), 7), "yyyy-MM-dd");
  const prevWeekEnd = format(subDays(parseISO(weekEnd), 7), "yyyy-MM-dd");

  const comparisons: ComparisonRow[] = [
    buildComparison("Hoje × Ontem (unidades)", todayRow.units, dayMap.get(yesterday)?.units ?? 0),
    buildComparison(
      "Semana atual × anterior (receita)",
      weekRevenue,
      allDays.filter((d) => d.date >= prevWeekStart && d.date <= prevWeekEnd).reduce((s, r) => s + r.revenue, 0),
    ),
    buildComparison("Mês atual × anterior (receita)", monthRevenue, prevMonthRevenue),
  ];

  const productGoals = buildProductGoals(input, effectiveDaily.units, referenceDate);
  const hourGoals = buildHourGoals(input, effectiveDaily.units, referenceDate);
  const challenges = buildChallenges(daily, streak, comparisons);
  const recommendations = buildRecommendations(input, daily, productGoals);

  const editable = {
    daily: buildEditableSlot("daily", storedDaily, suggestedDaily, effectiveDaily, dailySource),
    weekly: buildEditableSlot(
      "weekly",
      storedWeekly,
      suggestedWeekly,
      effectiveWeekly,
      weeklySource === "manual" || dailySource === "manual" ? "manual" : "smart",
    ),
    monthly: buildEditableSlot(
      "monthly",
      storedMonthly,
      suggestedMonthly,
      effectiveMonthly,
      monthlySource === "manual" || dailySource === "manual" ? "manual" : "smart",
    ),
  };

  return {
    businessId: input.businessId,
    referenceDate,
    daily,
    weekly,
    monthly: {
      ...monthlyBase,
      projectionRevenue: Math.round(paceRevenue * operationalDaysInMonth * 100) / 100,
      projectionProfit: Math.round(paceProfit * operationalDaysInMonth * 100) / 100,
      previousMonthRevenue: prevMonthRevenue,
      previousMonthChangePercent: computeGrowth(monthRevenue, prevMonthRevenue),
    },
    suggested: {
      daily: suggestedDaily,
      weekly: suggestedWeekly,
      monthly: suggestedMonthly,
    },
    source: dailySource,
    editable,
    streak,
    comparisons,
    productGoals,
    hourGoals,
    challenges,
    recommendations,
    avgUnitPrice,
    avgUnitProfit,
  };
}
