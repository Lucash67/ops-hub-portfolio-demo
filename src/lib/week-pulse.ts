/**
 * Resumo da semana em foco para o mini painel da dashboard.
 *
 * Usa as métricas diário-primeiro (mesma base do dia), então os números batem
 * com o card do dia e com os outros módulos.
 *
 * Mix de sabores: soma a semana inteira. Unidades sem sabor anotado são
 * rateadas pela composição da compra do dia (senão o card parece “só 1 dia”).
 */
import { addDays, format, parseISO, subDays } from "date-fns";
import { getWeekRange } from "@/lib/utils";
import {
  canonicalSalgadosFlavor,
  isSaleExcludedFromMix,
  isUnidentifiedFlavorProduct,
} from "@/lib/salgados-flavors";
import type { OperationalDayMetricsLike } from "@/lib/dashboard-view";

const WEEKDAY_LABEL = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

export interface WeekPulseDay {
  date: string;
  label: string;
  revenue: number;
  profit: number;
  units: number;
  /** Dia que está selecionado no filtro temporal. */
  isFocus: boolean;
}

export interface WeekPulseProduct {
  label: string;
  units: number;
}

export interface WeekPulse {
  start: string;
  end: string;
  /** "27/07 – 02/08" */
  rangeLabel: string;
  revenue: number;
  profit: number;
  units: number;
  margin: number;
  operationalDays: number;
  goalRevenue: number;
  goalProgress: number;
  /** Variação contra a semana anterior. null quando não há base de comparação. */
  profitTrend: number | null;
  revenueTrend: number | null;
  /** Mix da semana por sabor, do maior para o menor. */
  products: WeekPulseProduct[];
  /** Un. com sabor anotado na venda. */
  mixIdentifiedUnits: number;
  /** Un. rateadas via compra do dia (sabor não anotado). */
  mixAllocatedUnits: number;
  days: WeekPulseDay[];
  /** A semana do foco estava vazia e caímos na última semana com operação. */
  isFallback: boolean;
}

function sumProfit(days: OperationalDayMetricsLike[]): number {
  return days.reduce((total, day) => total + day.profit, 0);
}

function inRange(
  days: OperationalDayMetricsLike[],
  start: string,
  end: string,
): OperationalDayMetricsLike[] {
  return days.filter((day) => day.date >= start && day.date <= end);
}

/** Venda no formato mínimo necessário para o mix da semana. */
export interface WeekPulseSale {
  date: string;
  paymentStatus?: string | null;
  notes?: string | null;
  items?: Array<{ quantity: number; product?: { name: string } | null }>;
}

export interface WeekPulsePurchaseLine {
  name: string;
  quantity: number;
}

export interface WeekPulseOptions {
  goalRevenue?: number;
  /** Na visão geral, cai para a última semana operada quando a atual está vazia. */
  allowFallback?: boolean;
  /** Vendas do negócio — usadas para o mix por sabor. */
  sales?: WeekPulseSale[];
  /** Compra do dia → linhas de produto (para ratear não identificados). */
  purchasesByDate?: Record<string, WeekPulsePurchaseLine[]>;
}

function addUnits(map: Map<string, number>, label: string, qty: number) {
  if (qty <= 0) return;
  map.set(label, (map.get(label) ?? 0) + qty);
}

function purchaseWeights(lines: WeekPulsePurchaseLine[]): Array<{ label: string; weight: number }> {
  const weights = new Map<string, number>();
  for (const line of lines) {
    const flavor = canonicalSalgadosFlavor(line.name);
    if (!flavor) continue;
    weights.set(flavor, (weights.get(flavor) ?? 0) + Math.max(0, line.quantity));
  }
  const total = Array.from(weights.values()).reduce((s, n) => s + n, 0);
  if (total <= 0) return [];
  return Array.from(weights.entries()).map(([label, qty]) => ({
    label,
    weight: qty / total,
  }));
}

/**
 * Mix semanal: sabores anotados + rateio da compra do dia nos “não identificados”.
 * Assim o card reflete a semana inteira, não só os poucos tickets com sabor.
 */
export function buildProductMix(
  sales: WeekPulseSale[],
  start: string,
  end: string,
  purchasesByDate: Record<string, WeekPulsePurchaseLine[]> = {},
): {
  products: WeekPulseProduct[];
  identifiedUnits: number;
  allocatedUnits: number;
} {
  const units = new Map<string, number>();
  const unidentifiedByDate = new Map<string, number>();
  let identifiedUnits = 0;

  for (const sale of sales) {
    if (sale.date < start || sale.date > end) continue;
    if (isSaleExcludedFromMix(sale)) continue;
    for (const item of sale.items ?? []) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;
      const rawName = item.product?.name ?? "";
      if (isUnidentifiedFlavorProduct(rawName)) {
        unidentifiedByDate.set(sale.date, (unidentifiedByDate.get(sale.date) ?? 0) + qty);
        continue;
      }
      const flavor = canonicalSalgadosFlavor(rawName);
      if (!flavor) {
        unidentifiedByDate.set(sale.date, (unidentifiedByDate.get(sale.date) ?? 0) + qty);
        continue;
      }
      addUnits(units, flavor, qty);
      identifiedUnits += qty;
    }
  }

  let allocatedUnits = 0;
  for (const [date, unidentified] of Array.from(unidentifiedByDate.entries())) {
    if (unidentified <= 0) continue;
    const weights = purchaseWeights(purchasesByDate[date] ?? []);
    if (weights.length === 0) {
      // Sem compra do dia: mantém fora do mix (não inventa sabor).
      continue;
    }
    // Rateio em inteiros sem perder unidade (maior resto).
    const raw = weights.map((w) => ({
      label: w.label,
      exact: unidentified * w.weight,
    }));
    const floors = raw.map((r) => ({
      label: r.label,
      base: Math.floor(r.exact),
      frac: r.exact - Math.floor(r.exact),
    }));
    let remaining = unidentified - floors.reduce((s, r) => s + r.base, 0);
    floors
      .slice()
      .sort((a, b) => b.frac - a.frac)
      .forEach((row) => {
        if (remaining <= 0) return;
        row.base += 1;
        remaining -= 1;
      });
    for (const row of floors) {
      addUnits(units, row.label, row.base);
      allocatedUnits += row.base;
    }
  }

  const products = Array.from(units.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, units: value }));

  return { products, identifiedUnits, allocatedUnits };
}

export function buildWeekPulse(
  dayMetrics: OperationalDayMetricsLike[],
  focusDate: string,
  {
    goalRevenue = 0,
    allowFallback = false,
    sales = [],
    purchasesByDate = {},
  }: WeekPulseOptions = {},
): WeekPulse | null {
  let range = getWeekRange(parseISO(focusDate));
  let weekDays = inRange(dayMetrics, range.start, range.end);
  let isFallback = false;

  if (weekDays.length === 0 && allowFallback) {
    const previous =
      dayMetrics.filter((day) => day.date <= focusDate).at(-1) ?? dayMetrics.at(-1);
    if (previous) {
      range = getWeekRange(parseISO(previous.date));
      weekDays = inRange(dayMetrics, range.start, range.end);
      isFallback = true;
    }
  }

  if (weekDays.length === 0) return null;

  const revenue = weekDays.reduce((total, day) => total + day.revenue, 0);
  const profit = sumProfit(weekDays);
  const units = weekDays.reduce((total, day) => total + (day.units ?? 0), 0);
  const operationalDays = weekDays.filter(
    (day) => day.revenue > 0 || (day.units ?? 0) > 0,
  ).length;

  const byDate = new Map(weekDays.map((day) => [day.date, day]));
  const days: WeekPulseDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = format(addDays(parseISO(range.start), i), "yyyy-MM-dd");
    const weekday = parseISO(date).getDay();
    const metrics = byDate.get(date);
    // Fim de semana só entra na régua quando houve movimento.
    if (!metrics && (weekday === 0 || weekday === 6)) continue;
    days.push({
      date,
      label: WEEKDAY_LABEL[weekday] ?? "",
      revenue: metrics?.revenue ?? 0,
      profit: metrics?.profit ?? 0,
      units: metrics?.units ?? 0,
      isFocus: date === focusDate,
    });
  }

  const previousWeek = inRange(
    dayMetrics,
    format(subDays(parseISO(range.start), 7), "yyyy-MM-dd"),
    format(subDays(parseISO(range.end), 7), "yyyy-MM-dd"),
  );
  const previousProfit = sumProfit(previousWeek);
  const previousRevenue = previousWeek.reduce((total, day) => total + day.revenue, 0);

  const mix = buildProductMix(sales, range.start, range.end, purchasesByDate);

  return {
    start: range.start,
    end: range.end,
    rangeLabel: `${format(parseISO(range.start), "dd/MM")} – ${format(parseISO(range.end), "dd/MM")}`,
    revenue,
    profit,
    units,
    margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    operationalDays,
    goalRevenue,
    goalProgress: goalRevenue > 0 ? (revenue / goalRevenue) * 100 : 0,
    profitTrend:
      previousProfit > 0 ? ((profit - previousProfit) / previousProfit) * 100 : null,
    revenueTrend:
      previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : null,
    products: mix.products,
    mixIdentifiedUnits: mix.identifiedUnits,
    mixAllocatedUnits: mix.allocatedUnits,
    days,
    isFallback,
  };
}
