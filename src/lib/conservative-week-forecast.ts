/**
 * Projeção conservadora da próxima semana útil (seg–sex), a partir de um domingo.
 *
 * Usa a mesma mentalidade do cenário conservador do fechamento: ritmo 10% abaixo
 * do pior entre a média geral e a recente, sem inventar crescimento.
 */
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { isOperationalDay } from "@/lib/operational-calendar";

export interface ConservativeWeekDay {
  date: string;
  label: string;
  revenue: number;
  profit: number;
  units: number;
}

export interface ConservativeWeekForecast {
  /** Domingo de referência (ou o domingo da semana em foco). */
  fromDate: string;
  rangeLabel: string;
  premise: string;
  dailyRevenue: number;
  dailyProfit: number;
  dailyUnits: number;
  revenue: number;
  profit: number;
  units: number;
  days: ConservativeWeekDay[];
}

const WEEKDAY_LABEL = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const RECENT_WINDOW = 5;
const HAIRCUT = 0.9;

interface DayLike {
  date: string;
  revenue: number;
  profit: number;
  units?: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Segunda-feira da semana operacional que começa após o domingo em foco. */
function nextOperationalWeekStart(sundayKey: string): string {
  const sunday = parseISO(sundayKey);
  // Semana começa na segunda; se o foco já é domingo, a próxima seg é +1.
  const monday = startOfWeek(addDays(sunday, 1), { weekStartsOn: 1 });
  return format(monday, "yyyy-MM-dd");
}

export function buildConservativeWeekForecast(
  dayMetrics: DayLike[],
  focusDate: string,
  calendarId = "salgados",
): ConservativeWeekForecast | null {
  const operated = dayMetrics
    .filter((day) => day.revenue > 0 || day.profit > 0 || (day.units ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (operated.length === 0) return null;

  const recent = operated.slice(-RECENT_WINDOW);
  const avgRevenue = average(operated.map((d) => d.revenue));
  const avgProfit = average(operated.map((d) => d.profit));
  const avgUnits = average(operated.map((d) => d.units ?? 0));
  const recentRevenue = average(recent.map((d) => d.revenue));
  const recentProfit = average(recent.map((d) => d.profit));
  const recentUnits = average(recent.map((d) => d.units ?? 0));

  const dailyRevenue = round2(
    Math.min(avgRevenue, recentRevenue || Infinity) * HAIRCUT,
  );
  const dailyProfit = round2(
    Math.min(avgProfit, recentProfit || Infinity) * HAIRCUT,
  );
  const dailyUnits = Math.max(
    0,
    Math.round(Math.min(avgUnits, recentUnits || Infinity) * HAIRCUT),
  );

  const weekStart = nextOperationalWeekStart(focusDate);
  const days: ConservativeWeekDay[] = [];

  for (let i = 0; i < 5; i += 1) {
    const date = format(addDays(parseISO(weekStart), i), "yyyy-MM-dd");
    if (!isOperationalDay(date, calendarId)) continue;
    const weekday = parseISO(date).getDay();
    days.push({
      date,
      label: WEEKDAY_LABEL[weekday] ?? "",
      revenue: dailyRevenue,
      profit: dailyProfit,
      units: dailyUnits,
    });
  }

  if (days.length === 0) return null;

  const revenue = round2(days.reduce((sum, day) => sum + day.revenue, 0));
  const profit = round2(days.reduce((sum, day) => sum + day.profit, 0));
  const units = days.reduce((sum, day) => sum + day.units, 0);

  return {
    fromDate: focusDate,
    rangeLabel: `${format(parseISO(days[0]!.date), "dd/MM")} – ${format(parseISO(days[days.length - 1]!.date), "dd/MM")}`,
    premise:
      "Ritmo 10% abaixo do seu pior indicador (mês/histórico ou últimos dias), sem contar imprevistos extras.",
    dailyRevenue,
    dailyProfit,
    dailyUnits,
    revenue,
    profit,
    units,
    days,
  };
}
