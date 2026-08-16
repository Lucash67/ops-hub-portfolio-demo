import { format, subDays, parseISO, getDay } from "date-fns";
import { and, eq, inArray, lte } from "drizzle-orm";
import { calcGrowth, getWeekRange, getMonthRange, goalProgress } from "./utils";
import { getDailyGoalTarget } from "./goals-service";
import { getSmartGoalsView } from "./smart-goals-service";
import { ALL_BUSINESSES_ID, isAllBusinesses } from "./business-units";
import { getTenantDbIds } from "@/lib/auth/tenant-context";
import {
  computeDashboardMetrics,
  computeDayReport,
  computeRankings,
  computeProjections,
  computeCalendarDayStatus,
} from "./analytics-engine";
import { fetchMetricSales, fetchMetricGoals } from "@/platform/db/data-access/metrics";
import { buildOperationalDayMetrics } from "@/lib/operational-day-metrics";
import { getDualFinancialView, getDayDualFinancialView, getInvestmentFinanceRecords } from "./finance";
import type { DualFinancialView } from "./finance";
import { isPostgres, getPostgresDb, getSqliteDb } from "@/platform/db";
import { resolveBusinessScopeId } from "@/platform/db/mappers";
import { queryAll } from "@/platform/db/query";
import {
  cashFlow as sqliteCashFlow,
  investments as sqliteInvestments,
} from "./db/schema";
import { cashFlowEvents as pgCashFlow } from "@/lib/db/postgres/schema";
import { fetchActiveProducts, fetchScopedSales } from "./analytics-engine/queries";
import { buildClientSaleBusinessMap, filterClientsForBusiness } from "./client-business-scope";
import { fetchMetricClients } from "@/platform/db/data-access/metrics";
import { getClientById } from "@/platform/db/repositories/client-repository";
import { fetchMetricSaleItems } from "@/platform/db/data-access/metrics";
import { listProducts } from "@/platform/db/repositories/product-repository";
import { flavorQuantityBreakdown } from "./analytics-engine/aggregates";

export type { DashboardMetricsResult as DashboardMetrics } from "./analytics-engine";

export interface ChartDataPoint {
  label: string;
  value: number;
  profit?: number;
  revenue?: number;
}

function aggregateSalesByDate(
  sales: Awaited<ReturnType<typeof fetchMetricSales>>,
): Map<string, { revenue: number; profit: number }> {
  const map = new Map<string, { revenue: number; profit: number }>();
  for (const sale of sales) {
    const current = map.get(sale.date) ?? { revenue: 0, profit: 0 };
    current.revenue += sale.totalAmount;
    current.profit += sale.profit;
    map.set(sale.date, current);
  }
  return map;
}

function buildRevenueChartSeries(
  days: number,
  end: Date,
  businessId: string,
  metricsMap: Awaited<ReturnType<typeof buildOperationalDayMetrics>> | null,
  salesByDate: Map<string, { revenue: number; profit: number }>,
): ChartDataPoint[] {
  const result: ChartDataPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = format(subDays(end, i), "yyyy-MM-dd");
    const fromDiary = metricsMap?.get(date);
    const fromSales = salesByDate.get(date);
    const revenue = fromDiary?.revenue ?? fromSales?.revenue ?? 0;
    const profit = fromDiary?.profit ?? fromSales?.profit ?? 0;
    result.push({
      label: format(parseISO(date), "dd/MM"),
      value: revenue,
      revenue,
      profit,
    });
  }
  return result;
}

export async function getDashboardMetrics(businessId: string = ALL_BUSINESSES_ID) {
  return computeDashboardMetrics(businessId);
}

export async function getRevenueChart(
  days = 14,
  businessId: string = ALL_BUSINESSES_ID,
): Promise<ChartDataPoint[]> {
  const end = new Date();
  const startStr = format(subDays(end, days - 1), "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");
  const [metricsMap, sales] = await Promise.all([
    !isAllBusinesses(businessId) ? buildOperationalDayMetrics(businessId) : Promise.resolve(null),
    fetchMetricSales({ businessId, dateGte: startStr, dateLte: endStr }),
  ]);
  return buildRevenueChartSeries(days, end, businessId, metricsMap, aggregateSalesByDate(sales));
}

export async function getPaymentMethodChart(): Promise<ChartDataPoint[]> {
  const monthStart = getMonthRange().start;
  const monthSales = await fetchMetricSales({ dateGte: monthStart });

  const pix = monthSales.filter((s) => s.paymentMethod === "pix").reduce((s, v) => s + v.totalAmount, 0);
  const card = monthSales.filter((s) => s.paymentMethod === "card").reduce((s, v) => s + v.totalAmount, 0);
  const cash = monthSales.filter((s) => s.paymentMethod === "cash").reduce((s, v) => s + v.totalAmount, 0);

  return [
    { label: "PIX", value: pix },
    { label: "Cartão", value: card },
    { label: "Dinheiro", value: cash },
  ];
}

export async function getFlavorChart(): Promise<ChartDataPoint[]> {
  const monthStart = getMonthRange().start;
  const monthSales = await fetchMetricSales({ dateGte: monthStart });
  const saleIds = monthSales.map((s) => s.id).filter(Boolean) as string[];
  const allItems = await fetchMetricSaleItems(saleIds);
  const allProducts = await listProducts(ALL_BUSINESSES_ID);
  const productMap = new Map(allProducts.map((p) => [p.id, p.name]));

  const flavorCounts = flavorQuantityBreakdown(allItems, (id) => productMap.get(id) ?? "Desconhecido");

  return Object.entries(flavorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));
}

export async function getSalesChart(): Promise<ChartDataPoint[]> {
  const result: ChartDataPoint[] = [];

  for (let i = 13; i >= 0; i--) {
    const date = format(subDays(new Date(), i), "yyyy-MM-dd");
    const daySales = await fetchMetricSales({ dateEq: date });
    const saleIds = daySales.map((s) => s.id).filter(Boolean) as string[];
    const items = await fetchMetricSaleItems(saleIds);
    const count = items.reduce((s, i) => s + i.quantity, 0);
    result.push({ label: format(parseISO(date), "dd/MM"), value: count });
  }

  return result;
}

export async function getGrowthChart(): Promise<ChartDataPoint[]> {
  const result: ChartDataPoint[] = [];

  for (let i = 13; i >= 0; i--) {
    const date = format(subDays(new Date(), i), "yyyy-MM-dd");
    const prevDate = format(subDays(new Date(), i + 1), "yyyy-MM-dd");
    const daySales = await fetchMetricSales({ dateEq: date });
    const prevSales = await fetchMetricSales({ dateEq: prevDate });
    const revenue = daySales.reduce((s, v) => s + v.totalAmount, 0);
    const prevRevenue = prevSales.reduce((s, v) => s + v.totalAmount, 0);
    result.push({
      label: format(parseISO(date), "dd/MM"),
      value: calcGrowth(revenue, prevRevenue),
    });
  }

  return result;
}

export interface FinancialSummaryOptions {
  viewMode?: "general" | "day";
  /** No modo dia: acumulado até esta data (inclusive). */
  date?: string;
}

export async function getRevenueChartUpTo(
  days: number,
  businessId: string,
  endDate: string,
  metricsMap?: Awaited<ReturnType<typeof buildOperationalDayMetrics>> | null,
): Promise<ChartDataPoint[]> {
  const end = parseISO(endDate);
  const startStr = format(subDays(end, days - 1), "yyyy-MM-dd");
  const resolvedMap =
    metricsMap !== undefined
      ? metricsMap
      : !isAllBusinesses(businessId)
        ? await buildOperationalDayMetrics(businessId)
        : null;
  const sales = await fetchMetricSales({ businessId, dateGte: startStr, dateLte: endDate });
  return buildRevenueChartSeries(days, end, businessId, resolvedMap, aggregateSalesByDate(sales));
}

export async function getFinancialSummary(
  businessId: string = ALL_BUSINESSES_ID,
  options?: FinancialSummaryOptions,
) {
  const isDayScoped = options?.viewMode === "day" && options.date;
  const scopeEnd = isDayScoped ? options.date! : undefined;

  // Geral = histórico completo (não só o mês corrente); dia = acumulado até a data.
  const salesFilter = isDayScoped ? { businessId, dateLte: scopeEnd } : { businessId };
  const scopedSales = await fetchMetricSales(salesFilter);

  let grossRevenue: number;
  let operationalProfit: number;
  let totalCost: number;
  let dayScopedMetricsMap: Awaited<ReturnType<typeof buildOperationalDayMetrics>> | null = null;

  // Diário homologado é a fonte oficial em ambos os modos.
  dayScopedMetricsMap = await buildOperationalDayMetrics(businessId).catch(() => null);

  if (dayScopedMetricsMap && dayScopedMetricsMap.size > 0) {
    const days = Array.from(dayScopedMetricsMap.values()).filter(
      (d) => !scopeEnd || d.date <= scopeEnd,
    );
    grossRevenue = days.reduce((s, d) => s + d.revenue, 0);
    operationalProfit = days.reduce((s, d) => s + d.profit, 0);
    totalCost = days.reduce((s, d) => s + d.costs, 0);
  } else {
    grossRevenue = scopedSales.reduce((s, v) => s + v.totalAmount, 0);
    totalCost = scopedSales.reduce((s, v) => s + (v.totalCost ?? 0), 0);
    operationalProfit = scopedSales.reduce((s, v) => s + v.profit, 0);
  }

  let totalExpenses = 0;
  let incomeEntries: Array<{ category: string; amount: number }> = [];
  let expenseEntries: Array<{ amount: number }> = [];
  let scopedInvestments: Array<{
    id: string;
    description: string;
    amount: number;
    type: string;
    date: string;
    sourceType: string | null;
    sourceName: string | null;
    createdAt?: string;
  }> = [];

  if (isPostgres()) {
    const db = await getPostgresDb();
    const tenantIds = getTenantDbIds();
    const cashConditions: ReturnType<typeof eq>[] = [];
    if (!isAllBusinesses(businessId)) {
      cashConditions.push(eq(pgCashFlow.businessId, resolveBusinessScopeId(businessId)));
    } else if (tenantIds !== undefined) {
      if (tenantIds.length === 0) {
        expenseEntries = [];
        incomeEntries = [];
        totalExpenses = 0;
      } else {
        cashConditions.push(inArray(pgCashFlow.businessId, tenantIds));
      }
    }
    if (cashConditions.length > 0 || tenantIds === undefined) {
      const cashRows = await queryAll(
        cashConditions.length > 0
          ? db.select().from(pgCashFlow).where(and(...cashConditions))
          : db.select().from(pgCashFlow),
      );
      const filteredCash = scopeEnd
        ? cashRows.filter((e) => e.eventDate <= scopeEnd)
        : cashRows;
      expenseEntries = filteredCash
        .filter((e) => e.eventType === "expense")
        .map((e) => ({ amount: Number(e.amount) }));
      incomeEntries = filteredCash
        .filter((e) => e.eventType === "income")
        .map((e) => ({ category: e.category, amount: Number(e.amount) }));
      totalExpenses = expenseEntries.reduce((s, e) => s + e.amount, 0);
    }

    // Investimentos diários (compras) — antes ficavam vazios no Postgres.
    const investmentRecords = await getInvestmentFinanceRecords(businessId).catch(() => []);
    scopedInvestments = investmentRecords
      .filter((i) => !scopeEnd || i.date <= scopeEnd)
      .map((i) => ({
        id: i.id,
        description: i.description ?? "Investimento operacional",
        amount: i.amount,
        type: i.type,
        date: i.date,
        sourceType: i.sourceType ?? null,
        sourceName: i.sourceName ?? null,
      }));
  } else {
    const db = getSqliteDb();
    const expenses = (await queryAll(
      db.select().from(sqliteCashFlow).where(eq(sqliteCashFlow.type, "expense")),
    )) as Array<{ amount: number }>;
    totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    incomeEntries = (await queryAll(
      db.select().from(sqliteCashFlow).where(eq(sqliteCashFlow.type, "income")),
    )) as Array<{ category: string; amount: number }>;
    expenseEntries = expenses;
    const allInvestments = await queryAll(db.select().from(sqliteInvestments));
    scopedInvestments = (
      isAllBusinesses(businessId)
        ? allInvestments
        : allInvestments.filter((i) => i.businessId === businessId)
    )
      .filter((i) => !scopeEnd || i.date <= scopeEnd)
      .map((i) => ({
      id: i.id,
      description: i.description,
      amount: i.amount,
      type: i.type,
      date: i.date,
      sourceType: i.sourceType ?? null,
      sourceName: i.sourceName ?? null,
      createdAt: i.createdAt,
    }));
  }

  const investmentsOrdered = [...scopedInvestments].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const totalInvestments = scopedInvestments.reduce((s, i) => s + i.amount, 0);
  const investmentsSummary =
    scopedInvestments.length === 0
      ? "Nenhum investimento registrado."
      : investmentsOrdered
          .map((i) => `${i.date}: ${i.amount.toFixed(2).replace(".", ",")}`)
          .join(" · ");

  const netRevenue = grossRevenue - totalExpenses;
  const personalProfit = operationalProfit - totalExpenses * 0.3;
  const workingCapital = grossRevenue - totalCost;

  const deferredCollections = incomeEntries.filter((e) => e.category === "recebimento_venda_anterior");
  const otherIncome = incomeEntries.filter((e) => e.category !== "recebimento_venda_anterior");
  const totalIncome = grossRevenue + otherIncome.reduce((s, e) => s + e.amount, 0);
  const totalOut = expenseEntries.reduce((s, e) => s + e.amount, 0) + totalCost;

  // Geral considera o histórico completo; dia limita até a data selecionada.
  const dualPeriod = isDayScoped ? { end: scopeEnd } : undefined;
  const dualFinance = await getDualFinancialView(businessId, dualPeriod);

  const monthlyChart = isDayScoped
    ? await getRevenueChartUpTo(30, businessId, scopeEnd!, dayScopedMetricsMap)
    : await getRevenueChart(30, businessId);

  return {
    grossRevenue,
    netRevenue,
    operationalProfit,
    personalProfit,
    workingCapital,
    initialInvestment: totalInvestments,
    investments: investmentsOrdered,
    investmentsSummary,
    operatorFinance: dualFinance,
    cashFlow: {
      income: totalIncome,
      expenses: totalOut,
      balance: totalIncome - totalOut,
      deferredCollections: deferredCollections.reduce((s, e) => s + e.amount, 0),
    },
    monthlyChart,
    scope: isDayScoped ? { mode: "day" as const, date: scopeEnd! } : { mode: "general" as const },
  };
}

export async function getGoalsWithProgress(businessId: string = ALL_BUSINESSES_ID) {
  const allGoals = await fetchMetricGoals(businessId);
  // Diário homologado é a fonte de receita para progresso de metas.
  const metricsMap = await buildOperationalDayMetrics(businessId).catch(() => null);

  // Períodos são recalculados ao vivo (os armazenados congelam na criação da meta).
  // Âncora: último dia operacional homologado — mesma referência das Metas Inteligentes.
  const today = format(new Date(), "yyyy-MM-dd");
  const lastOperational =
    metricsMap && metricsMap.size > 0
      ? Array.from(metricsMap.keys()).sort().at(-1) ?? null
      : null;
  const anchorStr = lastOperational && lastOperational <= today ? lastOperational : today;
  const anchor = parseISO(anchorStr);

  const boundsFor = (type: string): { periodStart: string; periodEnd: string } => {
    switch (type) {
      case "weekly": {
        const w = getWeekRange(anchor);
        return { periodStart: w.start, periodEnd: w.end };
      }
      case "monthly": {
        const m = getMonthRange(anchor);
        return { periodStart: m.start, periodEnd: m.end };
      }
      case "yearly":
        return {
          periodStart: `${anchor.getFullYear()}-01-01`,
          periodEnd: `${anchor.getFullYear()}-12-31`,
        };
      default:
        return { periodStart: anchorStr, periodEnd: anchorStr };
    }
  };

  // Metas sem alvo configurado usam o alvo sugerido pelas Metas Inteligentes.
  let smartView: Awaited<ReturnType<typeof getSmartGoalsView>> = null;
  if (!isAllBusinesses(businessId) && allGoals.some((g) => g.targetAmount <= 0)) {
    smartView = await getSmartGoalsView(businessId).catch(() => null);
  }
  const suggestedTarget = (type: string): number => {
    if (!smartView) return 0;
    switch (type) {
      case "daily":
        return smartView.daily.targetRevenue;
      case "weekly":
        return smartView.weekly.targetRevenue;
      case "monthly":
        return smartView.monthly.targetRevenue;
      case "yearly":
        return smartView.monthly.targetRevenue * 12;
      default:
        return 0;
    }
  };

  const result = [];
  for (const goal of allGoals) {
    const live = boundsFor(goal.type);
    // Mensal e anual podem apontar para um período futuro (metas geradas pelo
    // Fechamento para o mês seguinte) e nesse caso mantêm o próprio período.
    // Diária e semanal seguem sempre a âncora, para refletirem o último dia
    // operado em vez de um dia ainda sem registro.
    const honorsStoredPeriod =
      (goal.type === "monthly" || goal.type === "yearly") &&
      goal.periodStart > live.periodStart &&
      goal.periodEnd >= today;
    const periodStart = honorsStoredPeriod ? goal.periodStart : live.periodStart;
    const periodEnd = honorsStoredPeriod ? goal.periodEnd : live.periodEnd;
    let current: number;
    if (metricsMap && metricsMap.size > 0) {
      current = Array.from(metricsMap.values())
        .filter((d) => d.date >= periodStart && d.date <= periodEnd)
        .reduce((s, d) => s + d.revenue, 0);
    } else {
      const periodSales = await fetchMetricSales({
        businessId,
        dateGte: periodStart,
        dateLte: periodEnd,
      });
      current = periodSales.reduce((s, v) => s + v.totalAmount, 0);
    }
    const configuredAmount = goal.targetAmount ?? 0;
    const configuredUnits = goal.targetUnits ?? null;
    const isCustom = configuredAmount > 0 || (configuredUnits != null && configuredUnits > 0);
    const targetSource = isCustom ? "custom" : "smart";
    const targetAmount = isCustom
      ? configuredAmount > 0
        ? configuredAmount
        : suggestedTarget(goal.type)
      : suggestedTarget(goal.type);
    const progress = goalProgress(current, targetAmount);
    result.push({
      ...goal,
      type: goal.type,
      configuredAmount,
      configuredUnits,
      targetAmount,
      targetUnits: configuredUnits,
      targetSource,
      periodStart,
      periodEnd,
      current,
      progress,
      completed: progress >= 100,
    });
  }
  return result;
}

export async function getRankings(businessId: string = ALL_BUSINESSES_ID) {
  return computeRankings(businessId);
}

export async function getCalendarData(
  year: number,
  month: number,
  businessId: string = ALL_BUSINESSES_ID,
) {
  let target = await getDailyGoalTarget(businessId);
  if (target <= 0 && !isAllBusinesses(businessId)) {
    const smart = await getSmartGoalsView(businessId).catch(() => null);
    target = smart?.daily.targetRevenue ?? 0;
  }
  const startDate = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
  const endDate = format(new Date(year, month, 0), "yyyy-MM-dd");

  const [monthSales, metricsMap] = await Promise.all([
    fetchScopedSales({ businessId, dateGte: startDate, dateLte: endDate }),
    buildOperationalDayMetrics(businessId).catch(() => null),
  ]);

  const dayData: Record<
    string,
    { revenue: number; status: "hit" | "close" | "miss"; sales: typeof monthSales }
  > = {};

  for (const sale of monthSales) {
    if (!dayData[sale.date]) {
      dayData[sale.date] = { revenue: 0, status: "miss", sales: [] };
    }
    dayData[sale.date].revenue += sale.totalAmount;
    dayData[sale.date].sales.push(sale);
  }

  // Diário homologado sobrescreve a receita do dia.
  if (metricsMap) {
    for (const day of Array.from(metricsMap.values())) {
      if (day.date < startDate || day.date > endDate) continue;
      if (!dayData[day.date]) {
        dayData[day.date] = { revenue: 0, status: "miss", sales: [] };
      }
      dayData[day.date].revenue = day.revenue;
    }
  }

  for (const [, data] of Object.entries(dayData)) {
    data.status = computeCalendarDayStatus(data.revenue, target);
  }

  return { dayData, target };
}

export async function getProjections(businessId: string = ALL_BUSINESSES_ID) {
  return computeProjections(businessId);
}

export async function getClientsForBusiness(businessId: string = ALL_BUSINESSES_ID) {
  const allClients = await fetchMetricClients();
  const saleBusinessMap = await buildClientSaleBusinessMap();
  return await filterClientsForBusiness(allClients, businessId, saleBusinessMap);
}

export async function getClientDetails(clientId: string, businessId: string = ALL_BUSINESSES_ID) {
  const client = await getClientById(clientId);
  if (!client) return null;

  let clientSales = (await fetchMetricSales()).filter((s) => s.clientId === clientId);
  if (!isAllBusinesses(businessId)) {
    clientSales = clientSales.filter((s) => s.businessId === businessId);
  }

  const saleIds = clientSales.map((s) => s.id).filter(Boolean) as string[];
  const allItems = await fetchMetricSaleItems(saleIds);
  const allProducts = await listProducts(ALL_BUSINESSES_ID);
  const productMap = new Map(allProducts.map((p) => [p.id, p]));

  const productCounts: Record<string, number> = {};
  for (const item of allItems) {
    const product = productMap.get(item.productId);
    if (product) {
      productCounts[product.name] = (productCounts[product.name] ?? 0) + item.quantity;
    }
  }

  const favoriteProduct =
    Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Sem histórico";
  const totalSpent = clientSales.reduce((s, v) => s + v.totalAmount, 0);

  return {
    client,
    purchaseCount: clientSales.length,
    totalSpent,
    favoriteProduct,
    lastPurchase: clientSales[0] ?? null,
    isRecurring: clientSales.length >= 3,
    sales: clientSales,
  };
}

export async function getLowStockProducts(businessId: string = ALL_BUSINESSES_ID) {
  return (await fetchActiveProducts(businessId)).filter(
    (p) => p.stockQuantity <= (p.minStock ?? 0),
  );
}

export async function getDayReport(date: string, businessId: string = ALL_BUSINESSES_ID) {
  const report = await computeDayReport(date, businessId);
  const operatorFinance = await getDayDualFinancialView(date, businessId);
  return { ...report, operatorFinance };
}

export type DayReportWithOperator = Awaited<ReturnType<typeof getDayReport>> & {
  operatorFinance: DualFinancialView;
};
