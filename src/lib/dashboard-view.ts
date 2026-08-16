import { format, parseISO, subDays, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getMonthRange, getWeekRange, formatCurrency } from "@/lib/utils";
import {
  canonicalSalgadosFlavor,
  isSaleExcludedFromMix,
} from "@/lib/salgados-flavors";
import {
  averageTicket,
  computeGoalProgress,
  computeGrowth,
  itemsSoldFromEmbedded,
  paymentBreakdown,
  flavorQuantityBreakdownFromEmbedded,
  sumProfit,
  sumRevenue,
  sumReceivedRevenue,
  sumPendingRevenue,
  saleReceivedAmount,
  uniqueCustomerCount,
} from "@/lib/analytics-engine/client";
import type { TemporalViewContext } from "@/stores/temporal-context-store";
import { deriveDiaryTotalProfit } from "@/lib/diary/types";
import type { OperationalDiaryEntry } from "@/lib/diary/types";
import { SALGADOS_BUSINESS_ID } from "@/lib/business-units";

export interface DashboardSaleItem {
  quantity: number;
  productId: string;
  subtotal: number;
  profit: number;
  product?: { id: string; name: string } | null;
}

export interface DashboardSale {
  id: string;
  businessId: string;
  date: string;
  time: string;
  clientId: string | null;
  paymentMethod: string;
  paymentStatus?: "paid" | "pending" | "partial" | string | null;
  amountReceived?: number | null;
  totalAmount: number;
  profit: number;
  notes?: string | null;
  client?: { id: string; name: string } | null;
  items: DashboardSaleItem[];
}

export interface DiaryDayContext {
  dailyGoalUnits?: number;
  quantitySold?: number;
  quantityLost?: number;
  lossReason?: string;
  revenue?: { received: number; pending: number; total: number };
  profit?: number;
  bonusIncome?: number;
  manualInsights?: string;
  commercialIntelligence?: {
    whatWeLearnedToday: string[];
    conclusion?: string;
  };
  suggestedActions?: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
  }>;
}

export interface DayTimelineEntry {
  id: string;
  time: string;
  clientName: string;
  products: string;
  paymentLabel: string;
  amount: number;
  statusLabel: string;
  statusTone: "success" | "warning" | "neutral";
}

export interface DayTimelineGroup {
  period: "morning" | "afternoon";
  label: string;
  entries: DayTimelineEntry[];
}

export interface DayExecutiveSummary {
  goalUnits: number | null;
  soldUnits: number;
  revenue: number;
  profit: number;
  pendingCount: number;
  pendingAmount: number;
  losses: number;
  lossReason?: string;
}

export interface DashboardActionableAlert {
  id: string;
  message: string;
  severity: "warning" | "info" | "opportunity";
}

export interface DashboardPriority {
  id: string;
  label: string;
}

export interface CustomerDayInsight {
  uniqueBuyers: number;
  topBuyer: { name: string; total: number } | null;
  summary: string;
}

export interface OperationResult {
  headline: string;
  percent: number;
  summary: string;
  tone: "success" | "warning" | "neutral";
}

export interface DashboardViewMetrics {
  revenueToday: number;
  profitToday: number;
  revenueWeek: number;
  revenueMonth: number;
  itemsSoldToday: number;
  currentStock: number;
  dailyGoal: number;
  goalProgress: number;
  customersToday: number;
  pixTotal: number;
  cardTotal: number;
  cashTotal: number;
  averageTicket: number;
  growthVsYesterday: number;
  hasOperations: boolean;
  goalRevenue: number;
}

export interface DashboardChartPoint {
  label: string;
  value: number;
  revenue?: number;
  profit?: number;
}

export interface DashboardViewData {
  metrics: DashboardViewMetrics;
  charts: {
    revenue: DashboardChartPoint[];
    sales: DashboardChartPoint[];
    payments: DashboardChartPoint[];
    flavors: DashboardChartPoint[];
  };
  isGeneralView: boolean;
  profitGrowthVsYesterday: number;
  operationResult: OperationResult;
  daySummary: DayExecutiveSummary | null;
  timeline: DayTimelineGroup[];
  alerts: DashboardActionableAlert[];
  priorities: DashboardPriority[];
  customerInsight: CustomerDayInsight;
  topProductsSubtitle: string;
  dayComparison: DayComparisonContext;
}

export interface DayComparisonContext {
  /** Exibir trend vs dia anterior operacional */
  enabled: boolean;
  /** Rótulo do período comparado — ex: "vs sexta", "vs ontem" */
  label: string;
  /** Data selecionada cai em sábado ou domingo (Salgados não opera) */
  isNonOperationalDay: boolean;
}

export function findLastOperationalDate(sales: DashboardSale[]): string | null {
  if (sales.length === 0) return null;
  const dates = Array.from(new Set(sales.map((s) => s.date))).sort();
  return dates.at(-1) ?? null;
}

function isWeekendDate(date: string): boolean {
  const day = getDay(parseISO(date));
  return day === 0 || day === 6;
}

function salgadosSkipsWeekends(businessId?: string): boolean {
  return businessId === SALGADOS_BUSINESS_ID;
}

/** Último dia útil anterior — pula sábado e domingo para Salgados. */
function getComparisonDate(viewDate: string, businessId?: string): string {
  let cursor = subDays(parseISO(viewDate), 1);
  if (!salgadosSkipsWeekends(businessId)) {
    return format(cursor, "yyyy-MM-dd");
  }
  while (getDay(cursor) === 0 || getDay(cursor) === 6) {
    cursor = subDays(cursor, 1);
  }
  return format(cursor, "yyyy-MM-dd");
}

function formatComparisonLabel(viewDate: string, compareDate: string): string {
  const calendarYesterday = format(subDays(parseISO(viewDate), 1), "yyyy-MM-dd");
  if (compareDate === calendarYesterday) return "vs ontem";
  const compareDay = getDay(parseISO(compareDate));
  if (compareDay === 5) return "vs sexta";
  return `vs ${format(parseISO(compareDate), "dd/MM", { locale: ptBR })}`;
}

function buildDayComparison(
  viewDate: string,
  businessId?: string,
): DayComparisonContext {
  if (salgadosSkipsWeekends(businessId) && isWeekendDate(viewDate)) {
    return {
      enabled: false,
      label: "",
      isNonOperationalDay: true,
    };
  }

  const compareDate = getComparisonDate(viewDate, businessId);
  return {
    enabled: true,
    label: formatComparisonLabel(viewDate, compareDate),
    isNonOperationalDay: false,
  };
}

function salesOnDate(sales: DashboardSale[], date: string): DashboardSale[] {
  return sales.filter((s) => s.date === date);
}

/** Estrutura mínima das métricas diárias diário-primeiro (evita importar código server-only). */
export interface OperationalDayMetricsLike {
  date: string;
  revenue: number;
  profit: number;
  units?: number;
}

function buildChartsForDates(
  sales: DashboardSale[],
  dates: string[],
  dayMetrics?: OperationalDayMetricsLike[] | null,
): { revenue: DashboardChartPoint[]; sales: DashboardChartPoint[] } {
  const metricsByDate = new Map((dayMetrics ?? []).map((d) => [d.date, d]));
  const allDates = Array.from(
    new Set([...dates, ...Array.from(metricsByDate.keys())]),
  ).sort();

  const revenue: DashboardChartPoint[] = [];
  const salesChart: DashboardChartPoint[] = [];
  for (const date of allDates) {
    const dSales = salesOnDate(sales, date);
    const diaryDay = metricsByDate.get(date);
    const rev = diaryDay?.revenue ?? sumRevenue(dSales);
    const profit = diaryDay?.profit ?? sumProfit(dSales);
    revenue.push({
      label: format(parseISO(date), "dd/MM"),
      value: rev,
      revenue: rev,
      profit,
    });
    salesChart.push({
      label: format(parseISO(date), "dd/MM"),
      value: diaryDay?.units ?? itemsSoldFromEmbedded(dSales),
    });
  }
  return { revenue, sales: salesChart };
}

function allOperationalDates(sales: DashboardSale[]): string[] {
  return Array.from(new Set(sales.map((s) => s.date))).sort();
}

function flavorBreakdown(salesList: DashboardSale[]): DashboardChartPoint[] {
  const counts = new Map<string, number>();
  for (const sale of salesList) {
    if (isSaleExcludedFromMix(sale)) continue;
    for (const item of sale.items ?? []) {
      const flavor = canonicalSalgadosFlavor(item.product?.name ?? "");
      if (!flavor) continue;
      counts.set(flavor, (counts.get(flavor) ?? 0) + item.quantity);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
};

function parseHour(time: string): number {
  const [h] = time.split(":");
  return parseInt(h ?? "0", 10);
}

function timelinePeriod(hour: number): DayTimelineGroup["period"] {
  return hour < 13 ? "morning" : "afternoon";
}

const PERIOD_LABELS: Record<DayTimelineGroup["period"], string> = {
  morning: "Manhã",
  afternoon: "Tarde",
};

function formatSaleProducts(sale: DashboardSale): string {
  return sale.items
    .map((item) => {
      const name = item.product?.name ?? "Produto";
      return item.quantity > 1 ? `${item.quantity}× ${name}` : name;
    })
    .join(", ");
}

function resolveSaleStatus(sale: DashboardSale): { label: string; tone: DayTimelineEntry["statusTone"] } {
  if (isSaleExcludedFromMix(sale)) {
    return { label: "Perda", tone: "warning" };
  }
  // Status de pagamento manda — notas com a palavra "fiado" (ex.: "quitação do fiado")
  // não podem marcar venda já paga como pendente.
  if (sale.paymentStatus === "pending") {
    return { label: "Pendente", tone: "warning" };
  }
  if (sale.paymentStatus === "partial") {
    return { label: "Parcial", tone: "warning" };
  }
  if (sale.paymentStatus === "paid") {
    const notes = (sale.notes ?? "").toLowerCase();
    if (notes.includes("parceiro") || notes.includes("pai")) {
      return { label: "Recebido", tone: "success" };
    }
    return { label: "Pago", tone: "success" };
  }
  const notes = (sale.notes ?? "").toLowerCase();
  if (notes.includes("fiado") || notes.includes("devendo") || notes.includes("pendente")) {
    return { label: "Pendente", tone: "warning" };
  }
  if (notes.includes("parceiro") || notes.includes("pai")) {
    return { label: "Recebido", tone: "success" };
  }
  return { label: "Pago", tone: "success" };
}

function buildDayTimeline(daySales: DashboardSale[]): DayTimelineGroup[] {
  const sorted = [...daySales].sort((a, b) => a.time.localeCompare(b.time));
  const grouped = new Map<DayTimelineGroup["period"], DayTimelineEntry[]>();

  for (const sale of sorted) {
    const period = timelinePeriod(parseHour(sale.time));
    const status = resolveSaleStatus(sale);
    const entry: DayTimelineEntry = {
      id: sale.id,
      time: sale.time,
      clientName: sale.client?.name ?? "Sem cliente",
      products: formatSaleProducts(sale) || "—",
      paymentLabel: PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod,
      amount: sale.totalAmount,
      statusLabel: status.label,
      statusTone: status.tone,
    };
    const list = grouped.get(period) ?? [];
    list.push(entry);
    grouped.set(period, list);
  }

  return (["morning", "afternoon"] as const)
    .filter((p) => (grouped.get(p)?.length ?? 0) > 0)
    .map((period) => ({
      period,
      label: PERIOD_LABELS[period],
      entries: grouped.get(period) ?? [],
    }));
}

function normalizeClientLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Clientes genéricos, roubos/fiado e pendências não entram no ranking de maior comprador. */
function isUnknownClientName(name: string): boolean {
  const n = normalizeClientLabel(name);
  if (!n) return true;
  if (n === "cliente") return true;
  if (n.startsWith("cliente nao identificado")) return true;
  if (n.startsWith("cliente avulso")) return true;
  if (n.startsWith("cliente fiado")) return true;
  if (n.includes("nao identificado")) return true;
  if (n.includes("nao pagou")) return true;
  return false;
}

function shouldExcludeFromTopBuyer(sale: DashboardSale): boolean {
  if (sale.paymentStatus === "pending" || sale.paymentStatus === "partial") return true;

  const notes = normalizeClientLabel(sale.notes ?? "");
  if (notes.includes("nao pagou") || notes.includes("roub") || notes.includes("fiado")) {
    return true;
  }

  const clientName = sale.client?.name ?? "";
  if (isUnknownClientName(clientName)) return true;

  return false;
}

function resolveAnonymousBuyerName(sale: DashboardSale): string {
  const notes = (sale.notes ?? "").toLowerCase();
  if (notes.includes("parceiro") || notes.includes("pai")) return "Parceiro";
  if (notes.includes("fiado") || notes.includes("devendo")) {
    return sale.client?.name?.split(" ")[0] ?? "Cliente fiado";
  }
  return "Cliente avulso";
}

function buildCustomerDayInsight(daySales: DashboardSale[]): CustomerDayInsight {
  const eligibleSales = daySales.filter((sale) => !shouldExcludeFromTopBuyer(sale));

  if (eligibleSales.length === 0) {
    return {
      uniqueBuyers: 0,
      topBuyer: null,
      summary: daySales.length > 0 ? "Sem comprador identificado" : "Nenhuma venda registrada",
    };
  }

  const ranked: Array<{ name: string; total: number }> = [];
  const byClient = new Map<string, { name: string; total: number }>();

  for (const sale of eligibleSales) {
    const amount = saleReceivedAmount(sale);
    if (amount <= 0) continue;

    if (sale.clientId && sale.client) {
      const existing = byClient.get(sale.clientId);
      if (existing) {
        existing.total += amount;
      } else {
        byClient.set(sale.clientId, { name: sale.client.name, total: amount });
      }
    } else {
      ranked.push({
        name: resolveAnonymousBuyerName(sale),
        total: amount,
      });
    }
  }

  for (const entry of Array.from(byClient.values())) {
    if (!isUnknownClientName(entry.name)) {
      ranked.push(entry);
    }
  }

  ranked.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));
  const topBuyer = ranked[0] ?? null;

  const identifiedCount = byClient.size;

  let summary: string;
  if (topBuyer) {
    const firstName = topBuyer.name.split(" ")[0];
    summary = `${firstName} foi o maior comprador do dia`;
  } else {
    summary = "Sem comprador identificado";
  }

  return {
    uniqueBuyers: identifiedCount,
    topBuyer,
    summary,
  };
}

function buildDayExecutiveSummary(
  daySales: DashboardSale[],
  metrics: DashboardViewMetrics,
  diary?: DiaryDayContext | null,
): DayExecutiveSummary {
  const pendingSales = daySales.filter((s) => {
    const label = resolveSaleStatus(s).label;
    return label === "Pendente" || label === "Parcial";
  });

  return {
    goalUnits: diary?.dailyGoalUnits ?? null,
    soldUnits: diary?.quantitySold ?? metrics.itemsSoldToday,
    revenue: diary?.revenue?.received ?? sumReceivedRevenue(daySales),
    profit:
      diary?.profit !== undefined || diary?.bonusIncome !== undefined
        ? deriveDiaryTotalProfit({
            profit: diary?.profit ?? metrics.profitToday,
            bonusIncome: diary?.bonusIncome,
          })
        : metrics.profitToday,
    pendingCount: pendingSales.length || (diary?.revenue?.pending ? 1 : 0),
    pendingAmount: diary?.revenue?.pending ?? sumPendingRevenue(daySales),
    // Diário é fonte oficial; se 0/ausente, ainda conta vendas marcadas como perda.
    losses: Math.max(
      Number(diary?.quantityLost) || 0,
      daySales
        .filter((s) => resolveSaleStatus(s).label === "Perda")
        .reduce((n, s) => n + s.items.reduce((q, it) => q + it.quantity, 0), 0),
    ),
    lossReason: diary?.lossReason,
  };
}

function buildOperationResult(
  metrics: DashboardViewMetrics,
  diary?: DiaryDayContext | null,
): OperationResult {
  const unitGoal = diary?.dailyGoalUnits;
  const sold = diary?.quantitySold ?? metrics.itemsSoldToday;

  if (unitGoal && unitGoal > 0) {
    const percent = Math.min(Math.round((sold / unitGoal) * 100), 999);
    const diff = sold - unitGoal;
    if (diff >= 0) {
      return {
        headline: "Meta batida",
        percent,
        summary: `${sold} de ${unitGoal} unidades — operação concluída`,
        tone: "success",
      };
    }
    return {
      headline: "Quase lá",
      percent,
      summary: `Faltam ${unitGoal - sold} unidade${unitGoal - sold > 1 ? "s" : ""} para a meta`,
      tone: percent >= 70 ? "warning" : "neutral",
    };
  }

  if (metrics.dailyGoal > 0) {
    const percent = Math.round(metrics.goalProgress);
    if (percent >= 100) {
      return {
        headline: "Meta financeira atingida",
        percent,
        summary: "Receita do dia dentro do objetivo",
        tone: "success",
      };
    }
    return {
      headline: "Em andamento",
      percent,
      summary: `${percent}% da meta financeira`,
      tone: percent >= 70 ? "warning" : "neutral",
    };
  }

  return {
    headline: sold > 0 ? "Operação ativa" : "Sem operação",
    percent: sold > 0 ? 100 : 0,
    summary: sold > 0 ? `${sold} unidades vendidas` : "Nenhuma venda registrada",
    tone: sold > 0 ? "success" : "neutral",
  };
}

function buildActionableAlerts(
  daySales: DashboardSale[],
  diary?: DiaryDayContext | null,
): DashboardActionableAlert[] {
  const alerts: DashboardActionableAlert[] = [];

  const pending = daySales.filter((s) => resolveSaleStatus(s).label === "Pendente");
  for (const sale of pending) {
    const name = sale.client?.name ?? "Cliente";
    alerts.push({
      id: `pending-${sale.id}`,
      message: `${name} possui pagamento pendente de ${sale.totalAmount.toFixed(2).replace(".", ",")} reais.`,
      severity: "warning",
    });
  }

  if (diary?.quantityLost && diary.quantityLost > 0) {
    alerts.push({
      id: "loss",
      message: `Você perdeu ${diary.quantityLost} salgado${diary.quantityLost > 1 ? "s" : ""}${diary.lossReason ? ` (${diary.lossReason})` : ""}.`,
      severity: "warning",
    });
  }

  if (diary?.manualInsights?.toLowerCase().includes("pastel esgotou")) {
    alerts.push({
      id: "pastel-soldout",
      message: "Pastel esgotou rapidamente — considere aumentar no mix de amanhã.",
      severity: "opportunity",
    });
  }

  const qrIssue = diary?.commercialIntelligence?.whatWeLearnedToday?.some(
    (line) => line.toLowerCase().includes("qr code") && line.toLowerCase().includes("zerado"),
  );
  if (qrIssue) {
    alerts.push({
      id: "qr-price",
      message: "O QR Code ainda não informa o preço — clientes perguntam antes de comprar.",
      severity: "warning",
    });
  }

  if (diary?.commercialIntelligence?.conclusion?.toLowerCase().includes("atrito")) {
    alerts.push({
      id: "sale-friction",
      message: "Existe atrito no processo de venda — revise a placa e o fluxo de pagamento.",
      severity: "info",
    });
  }

  return alerts;
}

function buildPriorities(diary?: DiaryDayContext | null): DashboardPriority[] {
  const items: DashboardPriority[] = [];

  if (diary?.revenue?.pending && diary.revenue.pending > 0) {
    items.push({ id: "collect-mikely", label: "Cobrar pagamento pendente (Mikely)." });
  }

  for (const action of diary?.suggestedActions ?? []) {
    if (action.status === "planned" || action.status === "in_progress") {
      items.push({ id: action.id, label: action.title });
    }
  }

  if (diary?.manualInsights?.toLowerCase().includes("pastel esgotou")) {
    items.push({ id: "buy-pastel", label: "Comprar mais Pastéis amanhã." });
  }

  return items;
}

function buildGeneralDashboardView(
  sales: DashboardSale[],
  currentStock: number,
  dailyGoal: number,
  totalRegisteredClients: number,
  dayMetrics?: OperationalDayMetricsLike[] | null,
): DashboardViewData {
  // Diário homologado é a fonte oficial de receita/lucro; vendas ficam para mix/pagamentos.
  const hasDiaryMetrics = !!dayMetrics && dayMetrics.length > 0;
  const totalRevenue = hasDiaryMetrics
    ? dayMetrics!.reduce((s, d) => s + d.revenue, 0)
    : sumRevenue(sales);
  const totalProfit = hasDiaryMetrics
    ? dayMetrics!.reduce((s, d) => s + d.profit, 0)
    : sumProfit(sales);
  const operationalDayCount = hasDiaryMetrics
    ? dayMetrics!.length
    : allOperationalDates(sales).length;
  const totalUnits = hasDiaryMetrics
    ? dayMetrics!.reduce(
        (s, d) => s + (d.units ?? itemsSoldFromEmbedded(salesOnDate(sales, d.date))),
        0,
      )
    : itemsSoldFromEmbedded(sales);
  const payments = paymentBreakdown(sales);
  const dates = allOperationalDates(sales);
  const charts = buildChartsForDates(sales, dates, dayMetrics);

  const today = new Date();
  const { start: weekStart, end: weekEnd } = getWeekRange(today);
  const { start: monthStart, end: monthEnd } = getMonthRange(today);
  const revenueWeek = hasDiaryMetrics
    ? dayMetrics!.filter((d) => d.date >= weekStart && d.date <= weekEnd).reduce((s, d) => s + d.revenue, 0)
    : sumRevenue(sales.filter((s) => s.date >= weekStart && s.date <= weekEnd));
  const revenueMonth = hasDiaryMetrics
    ? dayMetrics!.filter((d) => d.date >= monthStart && d.date <= monthEnd).reduce((s, d) => s + d.revenue, 0)
    : sumRevenue(sales.filter((s) => s.date >= monthStart && s.date <= monthEnd));

  // Meta geral = média de receita por dia operacional vs meta diária.
  const avgDailyRevenue = operationalDayCount > 0 ? totalRevenue / operationalDayCount : 0;
  const generalGoalProgress = computeGoalProgress(avgDailyRevenue, dailyGoal);
  const uniqueBuyers = uniqueCustomerCount(sales);
  const salesCount = sales.length;

  return {
    isGeneralView: true,
    metrics: {
      revenueToday: totalRevenue,
      profitToday: totalProfit,
      revenueWeek,
      revenueMonth,
      itemsSoldToday: totalUnits,
      currentStock,
      dailyGoal,
      goalProgress: generalGoalProgress,
      goalRevenue: avgDailyRevenue,
      customersToday: totalRegisteredClients > 0 ? totalRegisteredClients : uniqueBuyers,
      pixTotal: payments.pix,
      cardTotal: payments.card,
      cashTotal: payments.cash,
      averageTicket: averageTicket(totalRevenue, salesCount),
      growthVsYesterday: 0,
      hasOperations: sales.length > 0 || hasDiaryMetrics,
    },
    charts: {
      revenue: charts.revenue,
      sales: charts.sales,
      payments: [
        { label: "PIX", value: payments.pix },
        { label: "Cartão", value: payments.card },
        { label: "Dinheiro", value: payments.cash },
      ],
      flavors: flavorBreakdown(sales),
    },
    profitGrowthVsYesterday: 0,
    operationResult: buildOperationResult(
      {
        revenueToday: totalRevenue,
        profitToday: totalProfit,
        itemsSoldToday: totalUnits,
        dailyGoal,
        goalProgress: generalGoalProgress,
        goalRevenue: avgDailyRevenue,
      } as DashboardViewMetrics,
    ),
    daySummary: null,
    timeline: [],
    alerts: [],
    priorities: [],
    customerInsight: {
      uniqueBuyers: totalRegisteredClients > 0 ? totalRegisteredClients : uniqueBuyers,
      topBuyer: null,
      summary:
        totalRegisteredClients > 0
          ? `${totalRegisteredClients} clientes cadastrados`
          : `${uniqueBuyers} compradores únicos no histórico`,
    },
    topProductsSubtitle: "Histórico completo",
    dayComparison: { enabled: false, label: "", isNonOperationalDay: false },
  };
}

export function enrichDiaryContext(
  entry: OperationalDiaryEntry | null | undefined,
  autoGoalUnits?: number,
): DiaryDayContext | null {
  const goalUnits =
    entry?.dailyGoalUnits && entry.dailyGoalUnits > 0
      ? entry.dailyGoalUnits
      : autoGoalUnits && autoGoalUnits > 0
        ? autoGoalUnits
        : undefined;

  if (!entry && !goalUnits) return null;

  if (!entry) {
    return { dailyGoalUnits: goalUnits };
  }

  return {
    dailyGoalUnits: goalUnits,
    quantitySold: entry.quantitySold,
    quantityLost: entry.quantityLost,
    lossReason: entry.lossReason,
    revenue: entry.revenue,
    profit: entry.profit,
    bonusIncome: entry.bonusIncome,
    manualInsights: entry.manualInsights,
    commercialIntelligence: entry.commercialIntelligence,
    suggestedActions: entry.suggestedActions,
  };
}

export function buildDashboardView(
  sales: DashboardSale[],
  context: TemporalViewContext,
  currentStock: number,
  dailyGoal: number,
  totalRegisteredClients = 0,
  diary?: DiaryDayContext | null,
  businessId?: string,
  dayMetrics?: OperationalDayMetricsLike[] | null,
): DashboardViewData {
  if (context.mode === "general") {
    return buildGeneralDashboardView(sales, currentStock, dailyGoal, totalRegisteredClients, dayMetrics);
  }

  const viewDate = context.viewDate;
  const anchor = parseISO(viewDate);
  const dayComparison = buildDayComparison(viewDate, businessId);
  const compareDate = getComparisonDate(viewDate, businessId);
  const { start: weekStart, end: weekEnd } = getWeekRange(anchor);
  const { start: monthStart, end: monthEnd } = getMonthRange(anchor);

  const daySales = salesOnDate(sales, viewDate);
  const compareSales = salesOnDate(sales, compareDate);
  const metricsByDate = new Map((dayMetrics ?? []).map((d) => [d.date, d]));
  const focusMetrics = metricsByDate.get(viewDate);
  const compareMetrics = metricsByDate.get(compareDate);

  // Prioridade: diário do dia → métricas diário-primeiro → soma de vendas (último recurso).
  const diaryTotalProfit =
    diary?.profit !== undefined || diary?.bonusIncome !== undefined
      ? deriveDiaryTotalProfit({
          profit: diary?.profit ?? 0,
          bonusIncome: diary?.bonusIncome,
        })
      : null;

  const revenueToday =
    diary?.revenue?.received ?? focusMetrics?.revenue ?? sumReceivedRevenue(daySales);
  const profitToday =
    diaryTotalProfit ?? focusMetrics?.profit ?? sumProfit(daySales);
  const itemsSoldToday =
    diary?.quantitySold ?? focusMetrics?.units ?? itemsSoldFromEmbedded(daySales);

  const revenueWeek = dayMetrics?.length
    ? dayMetrics
        .filter((d) => d.date >= weekStart && d.date <= weekEnd)
        .reduce((sum, d) => sum + d.revenue, 0)
    : sumReceivedRevenue(sales.filter((s) => s.date >= weekStart && s.date <= weekEnd));
  const revenueMonth = dayMetrics?.length
    ? dayMetrics
        .filter((d) => d.date >= monthStart && d.date <= monthEnd)
        .reduce((sum, d) => sum + d.revenue, 0)
    : sumReceivedRevenue(sales.filter((s) => s.date >= monthStart && s.date <= monthEnd));
  const revenueCompare =
    compareMetrics?.revenue ?? sumReceivedRevenue(compareSales);
  const profitCompare = compareMetrics?.profit ?? sumProfit(compareSales);

  const customersToday = uniqueCustomerCount(daySales);
  const payments = paymentBreakdown(daySales);

  const revenueChart: DashboardChartPoint[] = [];
  const salesChart: DashboardChartPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = format(subDays(anchor, i), "yyyy-MM-dd");
    const dSales = salesOnDate(sales, date);
    const diaryDay = metricsByDate.get(date);
    const revenue = diaryDay?.revenue ?? sumReceivedRevenue(dSales);
    const profit = diaryDay?.profit ?? sumProfit(dSales);
    const label = format(parseISO(date), "dd/MM");
    revenueChart.push({ label, value: revenue, revenue, profit });
    salesChart.push({
      label,
      value: diaryDay?.units ?? itemsSoldFromEmbedded(dSales),
    });
  }

  const metrics: DashboardViewMetrics = {
    revenueToday,
    profitToday,
    revenueWeek,
    revenueMonth,
    itemsSoldToday,
    currentStock,
    dailyGoal,
    goalProgress: computeGoalProgress(revenueToday, dailyGoal),
    goalRevenue: revenueToday,
    customersToday,
    pixTotal: payments.pix,
    cardTotal: payments.card,
    cashTotal: payments.cash,
    averageTicket: averageTicket(revenueToday, daySales.length),
    growthVsYesterday: dayComparison.enabled
      ? computeGrowth(revenueToday, revenueCompare)
      : 0,
    hasOperations:
      daySales.length > 0 ||
      !!focusMetrics ||
      (diary?.quantitySold ?? 0) > 0 ||
      revenueToday > 0,
  };

  const unitGoal = diary?.dailyGoalUnits;
  const metaProgress =
    unitGoal && unitGoal > 0
      ? Math.min(Math.round(((diary?.quantitySold ?? itemsSoldToday) / unitGoal) * 100), 999)
      : metrics.goalProgress;

  return {
    isGeneralView: false,
    metrics: {
      ...metrics,
      goalProgress: metaProgress,
    },
    charts: {
      revenue: revenueChart,
      sales: salesChart,
      payments: [
        { label: "PIX", value: payments.pix },
        { label: "Cartão", value: payments.card },
        { label: "Dinheiro", value: payments.cash },
      ],
      flavors: flavorBreakdown(daySales),
    },
    profitGrowthVsYesterday: dayComparison.enabled
      ? computeGrowth(profitToday, profitCompare)
      : 0,
    operationResult: buildOperationResult(metrics, diary),
    daySummary: buildDayExecutiveSummary(daySales, metrics, diary),
    timeline: buildDayTimeline(daySales),
    alerts: buildActionableAlerts(daySales, diary),
    priorities: buildPriorities(diary),
    customerInsight: buildCustomerDayInsight(daySales),
    topProductsSubtitle: isViewingTodayContext(context) ? "Hoje" : format(anchor, "dd/MM/yyyy"),
    dayComparison,
  };
}

export function formatViewDateLabel(context: TemporalViewContext): string {
  if (context.mode === "general") {
    return "Visão executiva — histórico completo";
  }
  if (isViewingTodayContext(context)) {
    return format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });
  }
  return format(parseISO(context.viewDate), "EEEE, dd 'de' MMMM", { locale: ptBR });
}

export function formatContextSelectorLabel(context: TemporalViewContext): string {
  if (context.mode === "general") return "Geral";
  if (isViewingTodayContext(context)) return "Hoje";
  return format(parseISO(context.viewDate), "dd/MM/yyyy", { locale: ptBR });
}

function isViewingTodayContext(context: TemporalViewContext): boolean {
  return context.mode === "day" && context.viewDate === format(new Date(), "yyyy-MM-dd");
}
