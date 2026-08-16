/**
 * Fechamento de mês → previsão realista do mês seguinte → metas derivadas.
 *
 * Toda a matemática vive aqui (sem I/O) para poder ser conferida e reexecutada
 * sobre qualquer mês do histórico. A fonte de verdade é o mesmo dia operacional
 * que alimenta a dashboard (diário homologado).
 */
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { countOperationalDaysInRange, isOperationalDay } from "@/lib/operational-calendar";

export type ForecastScenarioKey = "conservador" | "realista" | "ambicioso";

export interface MonthCloseDay {
  date: string;
  label: string;
  weekday: number;
  revenue: number;
  profit: number;
  units: number;
}

export interface MonthSummary {
  monthKey: string;
  label: string;
  shortLabel: string;
  range: { start: string; end: string };
  isClosed: boolean;
  firstOperationalDate: string | null;
  lastOperationalDate: string | null;
  revenue: number;
  profit: number;
  costs: number;
  units: number;
  bonusIncome: number;
  margin: number;
  daysOperated: number;
  /** Dias úteis do mês inteiro. */
  daysAvailable: number;
  /** Dias úteis desde o primeiro dia operado (denominador honesto de presença). */
  daysAvailableSinceStart: number;
  attendanceRate: number;
  avgDailyRevenue: number;
  avgDailyProfit: number;
  avgDailyUnits: number;
  medianDailyProfit: number;
  /** Percentil 25 do lucro diário — piso usado no cenário conservador. */
  lowDailyProfit: number;
  lowDailyRevenue: number;
  lowDailyUnits: number;
  recentAvgDailyRevenue: number;
  recentAvgDailyProfit: number;
  recentAvgDailyUnits: number;
  bestDay: MonthCloseDay | null;
  worstDay: MonthCloseDay | null;
  avgUnitPrice: number;
  avgUnitProfit: number;
  costRatio: number;
  bonusPerUnit: number;
  trendPercent: number;
  trendLabel: string;
  consistencyPercent: number;
  days: MonthCloseDay[];
}

export interface ForecastScenario {
  key: ForecastScenarioKey;
  label: string;
  premise: string;
  daysOperated: number;
  dailyRevenue: number;
  dailyProfit: number;
  dailyUnits: number;
  revenue: number;
  profit: number;
  units: number;
  costs: number;
  bonusIncome: number;
  margin: number;
  changeVsReference: { revenue: number; profit: number };
  ownCapitalNeeded: number;
  thirdPartyCapitalNeeded: number;
}

export interface DerivedGoalRow {
  type: "daily" | "weekly" | "monthly" | "yearly";
  label: string;
  targetRevenue: number;
  targetProfit: number;
  targetUnits: number;
  basis: string;
}

export interface WeekPlanRow {
  index: number;
  label: string;
  rangeLabel: string;
  range: { start: string; end: string };
  operationalDays: number;
  weightPercent: number;
  targetRevenue: number;
  targetProfit: number;
  targetUnits: number;
  dailyUnits: number;
}

export interface WeekdayProfileRow {
  weekday: number;
  label: string;
  sampleDays: number;
  avgRevenue: number;
  avgProfit: number;
  avgUnits: number;
  /** 100 = igual à média geral. */
  indexVsAverage: number;
}

export interface CapitalPlan {
  referenceOwnInvestment: number;
  referenceThirdPartyInvestment: number;
  ownSharePercent: number;
  forecastTotalCost: number;
  forecastOwnCapital: number;
  forecastThirdPartyCapital: number;
  ownCapitalPerDay: number;
  /** Quantas vezes o lucro do mês fechado cobre o capital próprio do mês seguinte. */
  selfFundingRatio: number;
  note: string;
}

export interface ProfitMilestone {
  amount: number;
  label: string;
  date: string;
  dateLabel: string;
  operationalDaysAway: number;
}

export interface ForecastConfidence {
  level: "alta" | "média" | "baixa";
  sampleDays: number;
  variabilityPercent: number;
  reason: string;
}

export interface MonthHistoryRow {
  monthKey: string;
  label: string;
  revenue: number;
  profit: number;
  units: number;
  daysOperated: number;
}

export interface ForecastTracking {
  daysOperated: number;
  realizedRevenue: number;
  realizedProfit: number;
  expectedRevenueSoFar: number;
  expectedProfitSoFar: number;
  paceRevenuePercent: number;
  paceProfitPercent: number;
  status: "acima" | "dentro" | "abaixo";
  message: string;
}

export interface YearOutlook {
  year: number;
  realizedRevenue: number;
  realizedProfit: number;
  monthsRemaining: number;
  projectedRevenue: number;
  projectedProfit: number;
}

export interface MonthCloseView {
  businessId: string;
  generatedAt: string;
  availableMonths: Array<{ monthKey: string; label: string }>;
  reference: MonthSummary;
  previous: MonthSummary | null;
  nextMonth: {
    monthKey: string;
    label: string;
    shortLabel: string;
    range: { start: string; end: string };
    daysAvailable: number;
    expectedDaysOperated: number;
    daysGrowthPercent: number;
  };
  scenarios: ForecastScenario[];
  recommended: ForecastScenarioKey;
  /** Metas do cenário recomendado (atalho para `derivedGoalsByScenario[recommended]`). */
  derivedGoals: DerivedGoalRow[];
  derivedGoalsByScenario: Record<ForecastScenarioKey, DerivedGoalRow[]>;
  weeklyPlan: WeekPlanRow[];
  weeklyPlanByScenario: Record<ForecastScenarioKey, WeekPlanRow[]>;
  weekdayProfile: WeekdayProfileRow[];
  capitalPlan: CapitalPlan | null;
  milestones: ProfitMilestone[];
  confidence: ForecastConfidence;
  history: MonthHistoryRow[];
  tracking: ForecastTracking | null;
  yearOutlook: YearOutlook;
  narrative: string;
  insights: string[];
}

export interface MonthCloseDayInput {
  date: string;
  revenue: number;
  profit: number;
  costs: number;
  units?: number;
}

export interface MonthCloseInput {
  businessId: string;
  calendarBusinessId: string;
  /** Todos os dias operacionais do histórico, em qualquer ordem. */
  days: MonthCloseDayInput[];
  /** Bonificação/receita extra por dia (já embutida no lucro). */
  bonusByDate?: Record<string, number>;
  /** Investimentos do mês de referência, para o plano de capital. */
  investments?: Array<{ date: string; amount: number; own: boolean }>;
  /** Mês a fechar (yyyy-MM). Padrão: último mês encerrado com dados. */
  monthKey?: string;
  today: string;
}

const ROUND = 100;
const RECENT_WINDOW = 5;
const MILESTONE_STEP = 500;

function round2(value: number): number {
  return Math.round(value * ROUND) / ROUND;
}

function percentChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return round2(((current - previous) / previous) * 100);
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const low = sorted[base] ?? 0;
  const high = sorted[base + 1];
  return high === undefined ? low : low + rest * (high - low);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

function monthLabel(monthKey: string): string {
  return format(parseISO(`${monthKey}-01`), "MMMM 'de' yyyy", { locale: ptBR });
}

function monthShortLabel(monthKey: string): string {
  return format(parseISO(`${monthKey}-01`), "MMM/yy", { locale: ptBR });
}

function monthRange(monthKey: string): { start: string; end: string } {
  const first = parseISO(`${monthKey}-01`);
  return {
    start: format(startOfMonth(first), "yyyy-MM-dd"),
    end: format(endOfMonth(first), "yyyy-MM-dd"),
  };
}

function trendLabelFor(percent: number): string {
  if (percent >= 10) return "em aceleração";
  if (percent <= -10) return "em desaceleração";
  return "estável";
}

function buildMonthSummary(
  monthKey: string,
  allDays: MonthCloseDayInput[],
  bonusByDate: Record<string, number>,
  calendarId: string,
  today: string,
): MonthSummary {
  const range = monthRange(monthKey);
  const monthDays: MonthCloseDay[] = allDays
    .filter((d) => d.date >= range.start && d.date <= range.end)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      label: format(parseISO(d.date), "dd/MM"),
      weekday: getDay(parseISO(d.date)),
      revenue: round2(d.revenue),
      profit: round2(d.profit),
      units: d.units ?? 0,
    }));

  const revenue = round2(monthDays.reduce((s, d) => s + d.revenue, 0));
  const profit = round2(monthDays.reduce((s, d) => s + d.profit, 0));
  const units = monthDays.reduce((s, d) => s + d.units, 0);
  const costs = round2(revenue - profit);
  const bonusIncome = round2(
    monthDays.reduce((s, d) => s + (bonusByDate[d.date] ?? 0), 0),
  );

  const first = monthDays[0]?.date ?? null;
  const last = monthDays[monthDays.length - 1]?.date ?? null;
  const daysOperated = monthDays.length;
  const daysAvailable = countOperationalDaysInRange(range.start, range.end, calendarId);
  const attendanceEnd = range.end < today ? range.end : today;
  const daysAvailableSinceStart = first
    ? countOperationalDaysInRange(first, attendanceEnd < first ? first : attendanceEnd, calendarId)
    : 0;

  const profits = monthDays.map((d) => d.profit);
  const revenues = monthDays.map((d) => d.revenue);
  const unitList = monthDays.map((d) => d.units);
  const recent = monthDays.slice(-RECENT_WINDOW);

  const half = Math.floor(daysOperated / 2);
  const firstHalfAvg = average(profits.slice(0, half || daysOperated));
  const secondHalfAvg = average(profits.slice(half));
  const trendPercent = daysOperated >= 4 ? percentChange(secondHalfAvg, firstHalfAvg) : 0;

  const avgDailyProfit = average(profits);
  const stdDev =
    profits.length > 1
      ? Math.sqrt(average(profits.map((p) => (p - avgDailyProfit) ** 2)))
      : 0;
  const variability = avgDailyProfit > 0 ? (stdDev / avgDailyProfit) * 100 : 0;

  return {
    monthKey,
    label: monthLabel(monthKey),
    shortLabel: monthShortLabel(monthKey),
    range,
    isClosed: range.end < today,
    firstOperationalDate: first,
    lastOperationalDate: last,
    revenue,
    profit,
    costs,
    units,
    bonusIncome,
    margin: revenue > 0 ? round2((profit / revenue) * 100) : 0,
    daysOperated,
    daysAvailable,
    daysAvailableSinceStart,
    attendanceRate:
      daysAvailableSinceStart > 0
        ? Math.min(1, round2(daysOperated / daysAvailableSinceStart))
        : 0,
    avgDailyRevenue: round2(average(revenues)),
    avgDailyProfit: round2(avgDailyProfit),
    avgDailyUnits: round2(average(unitList)),
    medianDailyProfit: round2(quantile(profits, 0.5)),
    lowDailyProfit: round2(quantile(profits, 0.25)),
    lowDailyRevenue: round2(quantile(revenues, 0.25)),
    lowDailyUnits: round2(quantile(unitList, 0.25)),
    recentAvgDailyRevenue: round2(average(recent.map((d) => d.revenue))),
    recentAvgDailyProfit: round2(average(recent.map((d) => d.profit))),
    recentAvgDailyUnits: round2(average(recent.map((d) => d.units))),
    bestDay: monthDays.reduce<MonthCloseDay | null>(
      (best, d) => (!best || d.profit > best.profit ? d : best),
      null,
    ),
    worstDay: monthDays.reduce<MonthCloseDay | null>(
      (worst, d) => (!worst || d.profit < worst.profit ? d : worst),
      null,
    ),
    avgUnitPrice: units > 0 ? round2(revenue / units) : 0,
    avgUnitProfit: units > 0 ? round2(profit / units) : 0,
    costRatio: revenue > 0 ? round2(costs / revenue) : 0,
    bonusPerUnit: units > 0 ? round2(bonusIncome / units) : 0,
    trendPercent,
    trendLabel: trendLabelFor(trendPercent),
    consistencyPercent: round2(Math.max(0, Math.min(100, 100 - variability))),
    days: monthDays,
  };
}

/**
 * Presença esperada no mês seguinte. Um mês parcial (operação iniciada no meio)
 * não pode inflar nem deflacionar a expectativa: o que conta é a taxa de
 * comparecimento nos dias úteis que existiram desde o primeiro dia operado.
 */
function expectedDaysFor(reference: MonthSummary, nextDaysAvailable: number): number {
  if (reference.daysOperated === 0) return 0;
  const rate = reference.attendanceRate > 0 ? reference.attendanceRate : 1;
  return Math.max(1, Math.min(nextDaysAvailable, Math.round(nextDaysAvailable * rate)));
}

function buildScenario(
  key: ForecastScenarioKey,
  reference: MonthSummary,
  expectedDays: number,
  ownSharePercent: number,
): ForecastScenario {
  const blend = (overall: number, recent: number) =>
    recent > 0 ? overall * 0.6 + recent * 0.4 : overall;

  let label: string;
  let premise: string;
  let days = expectedDays;
  let dailyRevenue: number;
  let dailyProfit: number;
  let dailyUnits: number;

  if (key === "conservador") {
    // Piso: o pior entre o ritmo do mês e o ritmo recente, com folga e um dia perdido.
    // O mesmo desconto vale para receita, lucro e unidades, então a margem se mantém.
    const haircut = 0.9;
    label = "Conservador";
    days = Math.max(1, expectedDays - 1);
    dailyRevenue = Math.min(reference.avgDailyRevenue, reference.recentAvgDailyRevenue || Infinity) * haircut;
    dailyProfit = Math.min(reference.avgDailyProfit, reference.recentAvgDailyProfit || Infinity) * haircut;
    dailyUnits = Math.min(reference.avgDailyUnits, reference.recentAvgDailyUnits || Infinity) * haircut;
    premise = `Ritmo 10% abaixo do seu pior indicador (mês ou últimos dias) e 1 dia perdido por imprevisto.`;
  } else if (key === "ambicioso") {
    const growth = Math.max(0, Math.min(0.15, reference.trendPercent / 100));
    label = "Ambicioso";
    dailyRevenue = Math.max(reference.avgDailyRevenue, reference.recentAvgDailyRevenue) * (1 + growth);
    dailyProfit = Math.max(reference.avgDailyProfit, reference.recentAvgDailyProfit) * (1 + growth);
    dailyUnits = Math.max(reference.avgDailyUnits, reference.recentAvgDailyUnits) * (1 + growth);
    premise = `Ritmo dos melhores dias recentes com ${round2(growth * 100)}% de evolução e presença cheia.`;
  } else {
    label = "Realista";
    dailyRevenue = blend(reference.avgDailyRevenue, reference.recentAvgDailyRevenue);
    dailyProfit = blend(reference.avgDailyProfit, reference.recentAvgDailyProfit);
    dailyUnits = blend(reference.avgDailyUnits, reference.recentAvgDailyUnits);
    premise = `Média do mês com peso extra nos últimos ${Math.min(RECENT_WINDOW, reference.daysOperated)} dias, mantendo a mesma presença.`;
  }

  const revenue = round2(dailyRevenue * days);
  const profit = round2(dailyProfit * days);
  const units = Math.round(dailyUnits * days);
  const costs = round2(revenue - profit);

  return {
    key,
    label,
    premise,
    daysOperated: days,
    dailyRevenue: round2(dailyRevenue),
    dailyProfit: round2(dailyProfit),
    dailyUnits: round2(dailyUnits),
    revenue,
    profit,
    units,
    costs,
    bonusIncome: round2(units * reference.bonusPerUnit),
    margin: revenue > 0 ? round2((profit / revenue) * 100) : 0,
    changeVsReference: {
      revenue: percentChange(revenue, reference.revenue),
      profit: percentChange(profit, reference.profit),
    },
    ownCapitalNeeded: round2(costs * (ownSharePercent / 100)),
    thirdPartyCapitalNeeded: round2(costs * (1 - ownSharePercent / 100)),
  };
}

function buildWeekdayProfile(
  days: MonthCloseDayInput[],
  calendarId: string,
): WeekdayProfileRow[] {
  const buckets = new Map<number, { revenue: number[]; profit: number[]; units: number[] }>();
  for (const day of days) {
    if (!isOperationalDay(day.date, calendarId)) continue;
    const weekday = getDay(parseISO(day.date));
    const bucket = buckets.get(weekday) ?? { revenue: [], profit: [], units: [] };
    bucket.revenue.push(day.revenue);
    bucket.profit.push(day.profit);
    bucket.units.push(day.units ?? 0);
    buckets.set(weekday, bucket);
  }

  const overallAvgProfit = average(days.map((d) => d.profit));
  const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, bucket]) => {
      const avgProfit = average(bucket.profit);
      return {
        weekday,
        label: labels[weekday] ?? String(weekday),
        sampleDays: bucket.profit.length,
        avgRevenue: round2(average(bucket.revenue)),
        avgProfit: round2(avgProfit),
        avgUnits: round2(average(bucket.units)),
        indexVsAverage:
          overallAvgProfit > 0 ? round2((avgProfit / overallAvgProfit) * 100) : 100,
      };
    });
}

/** Peso do dia da semana, achatado para não superajustar em amostra pequena. */
function weekdayWeight(profile: WeekdayProfileRow[], weekday: number): number {
  const row = profile.find((r) => r.weekday === weekday);
  if (!row || row.sampleDays < 2) return 1;
  return Math.max(0.75, Math.min(1.25, row.indexVsAverage / 100));
}

interface MonthWeek {
  start: string;
  end: string;
  dates: string[];
}

function monthWeeks(nextMonthKey: string, calendarId: string): MonthWeek[] {
  const range = monthRange(nextMonthKey);
  const weeks: MonthWeek[] = [];

  let cursor = startOfWeek(parseISO(range.start), { weekStartsOn: 1 });
  const monthEnd = parseISO(range.end);

  while (cursor <= monthEnd) {
    const weekEnd = endOfWeek(cursor, { weekStartsOn: 1 });
    const start = format(cursor, "yyyy-MM-dd");
    const end = format(weekEnd, "yyyy-MM-dd");
    const clampedStart = start < range.start ? range.start : start;
    const clampedEnd = end > range.end ? range.end : end;

    const dates: string[] = [];
    let day = parseISO(clampedStart);
    const stop = parseISO(clampedEnd);
    while (day <= stop) {
      const key = format(day, "yyyy-MM-dd");
      if (isOperationalDay(key, calendarId)) dates.push(key);
      day = addDays(day, 1);
    }

    if (dates.length > 0) {
      weeks.push({ start: clampedStart, end: clampedEnd, dates });
    }
    // `endOfWeek` devolve o fim do dia; normalizar evita perder a última semana.
    cursor = startOfWeek(addDays(weekEnd, 1), { weekStartsOn: 1 });
  }

  return weeks;
}

function buildWeeklyPlan(
  weeks: MonthWeek[],
  scenario: ForecastScenario,
  profile: WeekdayProfileRow[],
): WeekPlanRow[] {
  const weights = weeks.map((week) =>
    week.dates.reduce((sum, date) => sum + weekdayWeight(profile, getDay(parseISO(date))), 0),
  );
  const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;

  const rows: WeekPlanRow[] = weeks.map((week, index) => {
    const weight = weights[index] ?? 0;
    const share = weight / totalWeight;
    const targetUnits = Math.round(scenario.units * share);
    return {
      index: index + 1,
      label: `Semana ${index + 1}`,
      rangeLabel: `${format(parseISO(week.start), "dd/MM")} – ${format(parseISO(week.end), "dd/MM")}`,
      range: { start: week.start, end: week.end },
      operationalDays: week.dates.length,
      weightPercent: round2(share * 100),
      targetRevenue: round2(scenario.revenue * share),
      targetProfit: round2(scenario.profit * share),
      targetUnits,
      dailyUnits: week.dates.length > 0 ? Math.round(targetUnits / week.dates.length) : 0,
    };
  });

  // O arredondamento por semana não pode mudar o total do cenário: a sobra
  // (ou falta) de unidades entra na semana mais pesada.
  const unitGap = scenario.units - rows.reduce((s, r) => s + r.targetUnits, 0);
  if (unitGap !== 0 && rows.length > 0) {
    const heaviest = rows.reduce((best, row) => (row.targetUnits > best.targetUnits ? row : best), rows[0]!);
    heaviest.targetUnits += unitGap;
    heaviest.dailyUnits =
      heaviest.operationalDays > 0 ? Math.round(heaviest.targetUnits / heaviest.operationalDays) : 0;
  }

  return rows;
}

function buildDerivedGoals(
  scenario: ForecastScenario,
  weeklyPlan: WeekPlanRow[],
  nextMonth: string,
  yearOutlook: YearOutlook,
): DerivedGoalRow[] {
  const days = scenario.daysOperated || 1;
  const fullWeeks = weeklyPlan.filter((w) => w.operationalDays >= 4);
  const weeklyRevenue =
    fullWeeks.length > 0
      ? average(fullWeeks.map((w) => w.targetRevenue))
      : (weeklyPlan[0]?.targetRevenue ?? 0);
  const weeklyProfit =
    fullWeeks.length > 0
      ? average(fullWeeks.map((w) => w.targetProfit))
      : (weeklyPlan[0]?.targetProfit ?? 0);
  const weeklyUnits =
    fullWeeks.length > 0
      ? average(fullWeeks.map((w) => w.targetUnits))
      : (weeklyPlan[0]?.targetUnits ?? 0);

  return [
    {
      type: "daily",
      label: "Meta diária",
      targetRevenue: round2(scenario.revenue / days),
      targetProfit: round2(scenario.profit / days),
      targetUnits: Math.round(scenario.units / days),
      basis: `Cenário ${scenario.label.toLowerCase()} dividido por ${days} dias úteis`,
    },
    {
      type: "weekly",
      label: "Meta semanal",
      targetRevenue: round2(weeklyRevenue),
      targetProfit: round2(weeklyProfit),
      targetUnits: Math.round(weeklyUnits),
      basis: "Média das semanas cheias do plano, já com peso por dia da semana",
    },
    {
      type: "monthly",
      label: `Meta de ${nextMonth}`,
      targetRevenue: scenario.revenue,
      targetProfit: scenario.profit,
      targetUnits: scenario.units,
      basis: `${scenario.daysOperated} dias úteis no ritmo previsto`,
    },
    {
      type: "yearly",
      label: `Fechamento de ${yearOutlook.year}`,
      targetRevenue: yearOutlook.projectedRevenue,
      targetProfit: yearOutlook.projectedProfit,
      targetUnits: 0,
      basis: `Realizado até agora + ${yearOutlook.monthsRemaining} mês(es) no mesmo ritmo`,
    },
  ];
}

function buildMilestones(
  realizedProfit: number,
  scenario: ForecastScenario,
  nextMonthKey: string,
  calendarId: string,
): ProfitMilestone[] {
  if (scenario.dailyProfit <= 0) return [];

  const range = monthRange(nextMonthKey);
  const milestones: ProfitMilestone[] = [];
  let target = Math.ceil((realizedProfit + 1) / MILESTONE_STEP) * MILESTONE_STEP;
  let cumulative = realizedProfit;
  let operationalDay = 0;
  let cursor = parseISO(range.start);
  const stop = parseISO(range.end);

  while (cursor <= stop && milestones.length < 3) {
    const key = format(cursor, "yyyy-MM-dd");
    if (isOperationalDay(key, calendarId)) {
      operationalDay++;
      cumulative += scenario.dailyProfit;
      while (cumulative >= target && milestones.length < 3) {
        milestones.push({
          amount: target,
          label: `R$${target.toLocaleString("pt-BR")} de lucro acumulado`,
          date: key,
          dateLabel: format(cursor, "dd/MM", { locale: ptBR }),
          operationalDaysAway: operationalDay,
        });
        target += MILESTONE_STEP;
      }
    }
    cursor = addDays(cursor, 1);
  }

  return milestones;
}

function buildConfidence(reference: MonthSummary): ForecastConfidence {
  const variability = round2(Math.max(0, 100 - reference.consistencyPercent));
  const sampleDays = reference.daysOperated;

  let level: ForecastConfidence["level"];
  if (sampleDays >= 16 && variability <= 40) level = "alta";
  else if (sampleDays >= 8 && variability <= 60) level = "média";
  else level = "baixa";

  const reason =
    sampleDays === 0
      ? "Sem dias operados no mês de referência."
      : `${sampleDays} dias operados e variação diária de ${variability.toFixed(0)}% no lucro. ` +
        (level === "alta"
          ? "Amostra boa: a previsão tende a se sustentar."
          : level === "média"
            ? "Amostra razoável: trate a previsão como direção, não como promessa."
            : "Amostra curta: revise a previsão a cada semana operada.");

  return { level, sampleDays, variabilityPercent: variability, reason };
}

function buildTracking(
  next: MonthSummary,
  scenario: ForecastScenario,
): ForecastTracking | null {
  if (next.daysOperated === 0) return null;

  const expectedRevenue = round2(scenario.dailyRevenue * next.daysOperated);
  const expectedProfit = round2(scenario.dailyProfit * next.daysOperated);
  const paceProfit = percentChange(next.profit, expectedProfit);
  const status: ForecastTracking["status"] =
    paceProfit >= 5 ? "acima" : paceProfit <= -5 ? "abaixo" : "dentro";

  return {
    daysOperated: next.daysOperated,
    realizedRevenue: next.revenue,
    realizedProfit: next.profit,
    expectedRevenueSoFar: expectedRevenue,
    expectedProfitSoFar: expectedProfit,
    paceRevenuePercent: percentChange(next.revenue, expectedRevenue),
    paceProfitPercent: paceProfit,
    status,
    message:
      status === "acima"
        ? `Depois de ${next.daysOperated} dia(s), o lucro está ${Math.abs(paceProfit).toFixed(0)}% acima do previsto.`
        : status === "abaixo"
          ? `Depois de ${next.daysOperated} dia(s), o lucro está ${Math.abs(paceProfit).toFixed(0)}% abaixo do previsto.`
          : `Depois de ${next.daysOperated} dia(s), o ritmo está em linha com a previsão.`,
  };
}

interface InvestmentSplit {
  own: number;
  thirdParty: number;
  ownSharePercent: number;
}

/** Quanto do custo do mês saiu do bolso do operador vs de terceiros. */
function investmentSplit(
  reference: MonthSummary,
  investments: NonNullable<MonthCloseInput["investments"]>,
): InvestmentSplit | null {
  const scoped = investments.filter(
    (i) => i.date >= reference.range.start && i.date <= reference.range.end,
  );
  if (scoped.length === 0) return null;

  const own = round2(scoped.filter((i) => i.own).reduce((s, i) => s + i.amount, 0));
  const thirdParty = round2(scoped.filter((i) => !i.own).reduce((s, i) => s + i.amount, 0));
  const total = own + thirdParty;
  if (total <= 0) return null;

  return { own, thirdParty, ownSharePercent: round2((own / total) * 100) };
}

function buildCapitalPlan(
  reference: MonthSummary,
  scenario: ForecastScenario,
  split: InvestmentSplit | null,
): CapitalPlan | null {
  if (!split) return null;

  const { own, thirdParty, ownSharePercent: ownShare } = split;
  const forecastOwn = round2(scenario.costs * (ownShare / 100));

  return {
    referenceOwnInvestment: own,
    referenceThirdPartyInvestment: thirdParty,
    ownSharePercent: ownShare,
    forecastTotalCost: scenario.costs,
    forecastOwnCapital: forecastOwn,
    forecastThirdPartyCapital: round2(scenario.costs - forecastOwn),
    ownCapitalPerDay:
      scenario.daysOperated > 0 ? round2(forecastOwn / scenario.daysOperated) : 0,
    selfFundingRatio: forecastOwn > 0 ? round2(reference.profit / forecastOwn) : 0,
    note: `Em ${reference.shortLabel} você bancou ${ownShare.toFixed(0)}% do custo dos salgados; o resto veio de terceiros.`,
  };
}

function buildNarrative(
  reference: MonthSummary,
  scenario: ForecastScenario,
  nextLabel: string,
  nextDaysAvailable: number,
): string {
  const money = (v: number) => `R$${v.toFixed(2).replace(".", ",")}`;
  const dayGrowth = percentChange(scenario.daysOperated, reference.daysOperated);

  return (
    `${reference.label} fechou com ${money(reference.revenue)} de faturamento e ${money(reference.profit)} de lucro ` +
    `em ${reference.daysOperated} dias úteis operados — média de ${money(reference.avgDailyProfit)} de lucro por dia ` +
    `e margem de ${reference.margin.toFixed(1)}%. ` +
    `${nextLabel} tem ${nextDaysAvailable} dias úteis disponíveis` +
    (dayGrowth > 0 ? ` (${dayGrowth.toFixed(0)}% mais dias de operação)` : "") +
    `. Mantendo o mesmo ritmo em ${scenario.daysOperated} dias, a tendência é fechar em ` +
    `${money(scenario.revenue)} de faturamento e ${money(scenario.profit)} de lucro.`
  );
}

function buildInsights(
  reference: MonthSummary,
  scenarios: ForecastScenario[],
  profile: WeekdayProfileRow[],
  weeklyPlan: WeekPlanRow[],
  capitalPlan: CapitalPlan | null,
  previous: MonthSummary | null,
): string[] {
  const insights: string[] = [];
  const realista = scenarios.find((s) => s.key === "realista");
  const conservador = scenarios.find((s) => s.key === "conservador");
  const money = (v: number) => `R$${v.toFixed(2).replace(".", ",")}`;

  if (reference.attendanceRate >= 0.999 && reference.daysOperated > 0) {
    insights.push(
      `Presença de 100%: você operou todos os ${reference.daysOperated} dias úteis disponíveis desde ${format(parseISO(reference.firstOperationalDate ?? reference.range.start), "dd/MM")}. A previsão assume que isso se mantém.`,
    );
  } else if (reference.attendanceRate > 0) {
    insights.push(
      `Você operou ${reference.daysOperated} de ${reference.daysAvailableSinceStart} dias úteis possíveis (${(reference.attendanceRate * 100).toFixed(0)}%). A previsão desconta essa taxa em vez de assumir mês cheio.`,
    );
  }

  const ambicioso = scenarios.find((s) => s.key === "ambicioso");
  if (conservador && ambicioso) {
    const delta = conservador.profit - reference.profit;
    insights.push(
      `Faixa do mês: lucro entre ${money(conservador.profit)} e ${money(ambicioso.profit)}. ` +
        (delta >= 0
          ? `Mesmo no piso você fica ${money(delta)} acima do mês fechado, só pelo ganho de dias úteis.`
          : `No piso o mês fica ${money(Math.abs(delta))} abaixo do fechado — atenção para não perder dias.`),
    );
  }

  const best = [...profile].sort((a, b) => b.indexVsAverage - a.indexVsAverage)[0];
  const worst = [...profile].sort((a, b) => a.indexVsAverage - b.indexVsAverage)[0];
  if (best && worst && best.weekday !== worst.weekday && best.sampleDays >= 2) {
    insights.push(
      `${best.label} é seu dia mais forte (${(best.indexVsAverage - 100).toFixed(0)}% acima da média) e ${worst.label} o mais fraco (${(worst.indexVsAverage - 100).toFixed(0)}%). O plano semanal já distribui as metas com esse peso.`,
    );
  }

  if (reference.bonusPerUnit > 0 && realista) {
    insights.push(
      `A bonificação do Henrique (${money(reference.bonusPerUnit)} por unidade) deve render ${money(realista.bonusIncome)} — ${((realista.bonusIncome / (realista.profit || 1)) * 100).toFixed(0)}% do lucro previsto vem dela, não da margem dos salgados.`,
    );
  }

  if (capitalPlan) {
    insights.push(
      `Capital: prepare ${money(capitalPlan.forecastOwnCapital)} do seu bolso (${money(capitalPlan.ownCapitalPerDay)} por dia). O lucro de ${reference.shortLabel} cobre isso ${capitalPlan.selfFundingRatio.toFixed(1)}× — a operação já se autofinancia.`,
    );
  }

  const heaviest = [...weeklyPlan].sort((a, b) => b.targetUnits - a.targetUnits)[0];
  if (heaviest) {
    insights.push(
      `Semana mais pesada: ${heaviest.rangeLabel} com ${heaviest.targetUnits} unidades (${heaviest.dailyUnits}/dia). Encomende com folga nesse período.`,
    );
  }

  if (previous && previous.daysOperated > 0) {
    insights.push(
      `Contra ${previous.shortLabel}: lucro por dia útil ${percentChange(reference.avgDailyProfit, previous.avgDailyProfit).toFixed(0)}% e margem ${(reference.margin - previous.margin).toFixed(1)} p.p. de diferença.`,
    );
  }

  if (reference.trendPercent !== 0) {
    insights.push(
      `Dentro do próprio mês o ritmo ficou ${reference.trendLabel} (${reference.trendPercent > 0 ? "+" : ""}${reference.trendPercent.toFixed(0)}% da 1ª para a 2ª metade). O cenário realista dá peso extra aos últimos dias por isso.`,
    );
  }

  return insights;
}

export function buildMonthCloseView(input: MonthCloseInput): MonthCloseView | null {
  const { businessId, calendarBusinessId, days, today } = input;
  if (days.length === 0) return null;

  const bonusByDate = input.bonusByDate ?? {};
  const monthKeys = Array.from(new Set(days.map((d) => monthKeyOf(d.date)))).sort();
  const closedMonths = monthKeys.filter((key) => monthRange(key).end < today);
  const referenceKey =
    input.monthKey && monthKeys.includes(input.monthKey)
      ? input.monthKey
      : (closedMonths[closedMonths.length - 1] ?? monthKeys[monthKeys.length - 1]!);

  const reference = buildMonthSummary(referenceKey, days, bonusByDate, calendarBusinessId, today);
  if (reference.daysOperated === 0) return null;

  const previousKey = format(addMonths(parseISO(`${referenceKey}-01`), -1), "yyyy-MM");
  const previous = monthKeys.includes(previousKey)
    ? buildMonthSummary(previousKey, days, bonusByDate, calendarBusinessId, today)
    : null;

  const nextKey = format(addMonths(parseISO(`${referenceKey}-01`), 1), "yyyy-MM");
  const nextRange = monthRange(nextKey);
  const nextDaysAvailable = countOperationalDaysInRange(
    nextRange.start,
    nextRange.end,
    calendarBusinessId,
  );
  const expectedDays = expectedDaysFor(reference, nextDaysAvailable);

  const split = investmentSplit(reference, input.investments ?? []);
  const ownShare = split?.ownSharePercent ?? 0;

  const scenarios: ForecastScenario[] = (
    ["conservador", "realista", "ambicioso"] as ForecastScenarioKey[]
  ).map((key) => buildScenario(key, reference, expectedDays, ownShare));
  const realista = scenarios.find((s) => s.key === "realista")!;

  const profile = buildWeekdayProfile(days, calendarBusinessId);
  const weeks = monthWeeks(nextKey, calendarBusinessId);

  const realizedProfit = round2(days.reduce((s, d) => s + d.profit, 0));
  const year = Number(referenceKey.slice(0, 4));
  const yearDays = days.filter((d) => d.date.startsWith(`${year}-`));
  const yearRealizedProfit = round2(yearDays.reduce((s, d) => s + d.profit, 0));
  const yearRealizedRevenue = round2(yearDays.reduce((s, d) => s + d.revenue, 0));
  const monthsRemaining = Math.max(0, 12 - Number(nextKey.slice(5, 7)) + 1);
  const yearOutlookFor = (scenario: ForecastScenario): YearOutlook => ({
    year,
    realizedRevenue: yearRealizedRevenue,
    realizedProfit: yearRealizedProfit,
    monthsRemaining,
    projectedRevenue: round2(yearRealizedRevenue + scenario.revenue * monthsRemaining),
    projectedProfit: round2(yearRealizedProfit + scenario.profit * monthsRemaining),
  });

  // Plano e metas são calculados para cada cenário — trocar de cenário na tela
  // não reescala números, recalcula tudo com a mesma matemática.
  const weeklyPlanByScenario = {} as Record<ForecastScenarioKey, WeekPlanRow[]>;
  const derivedGoalsByScenario = {} as Record<ForecastScenarioKey, DerivedGoalRow[]>;
  for (const scenario of scenarios) {
    const plan = buildWeeklyPlan(weeks, scenario, profile);
    weeklyPlanByScenario[scenario.key] = plan;
    derivedGoalsByScenario[scenario.key] = buildDerivedGoals(
      scenario,
      plan,
      monthShortLabel(nextKey),
      yearOutlookFor(scenario),
    );
  }

  const weeklyPlan = weeklyPlanByScenario.realista;
  const yearOutlook = yearOutlookFor(realista);
  const nextSummary = buildMonthSummary(nextKey, days, bonusByDate, calendarBusinessId, today);
  const capitalPlan = buildCapitalPlan(reference, realista, split);

  return {
    businessId,
    generatedAt: today,
    availableMonths: [...monthKeys]
      .reverse()
      .map((key) => ({ monthKey: key, label: monthLabel(key) })),
    reference,
    previous,
    nextMonth: {
      monthKey: nextKey,
      label: monthLabel(nextKey),
      shortLabel: monthShortLabel(nextKey),
      range: nextRange,
      daysAvailable: nextDaysAvailable,
      expectedDaysOperated: expectedDays,
      daysGrowthPercent: percentChange(expectedDays, reference.daysOperated),
    },
    scenarios,
    recommended: "realista",
    derivedGoals: derivedGoalsByScenario.realista,
    derivedGoalsByScenario,
    weeklyPlan,
    weeklyPlanByScenario,
    weekdayProfile: profile,
    capitalPlan,
    milestones: buildMilestones(realizedProfit, realista, nextKey, calendarBusinessId),
    confidence: buildConfidence(reference),
    history: monthKeys.map((key) => {
      const summary = buildMonthSummary(key, days, bonusByDate, calendarBusinessId, today);
      return {
        monthKey: key,
        label: monthShortLabel(key),
        revenue: summary.revenue,
        profit: summary.profit,
        units: summary.units,
        daysOperated: summary.daysOperated,
      };
    }),
    tracking: buildTracking(nextSummary, realista),
    yearOutlook,
    narrative: buildNarrative(reference, realista, monthLabel(nextKey), nextDaysAvailable),
    insights: buildInsights(reference, scenarios, profile, weeklyPlan, capitalPlan, previous),
  };
}

export { round2 as roundMoney, percentChange as monthPercentChange };
