/**
 * Métricas compostas — orquestra queries + aggregates.
 */
import { format, subDays, parseISO, getDay } from "date-fns";
import { isUnidentifiedFlavorProduct } from "@/lib/salgados-flavors";
import { SHIFT_LABEL, shiftFromHour } from "@/lib/sale-shift";
import { getWeekRange, getMonthRange, goalProgress } from "@/lib/utils";
import { getDailyGoalTarget } from "@/lib/goals-service";
import { ALL_BUSINESSES_ID } from "@/lib/business-units";
import {
  averageProductCost,
  averageProductPrice,
  averageTicket,
  computeGrowth,
  computeGoalProgress,
  itemsSoldFromItems,
  paymentBreakdown,
  productQuantityBreakdown,
  flavorQuantityBreakdown,
  revenueByDate,
  revenueByDayOfWeek,
  salesCountByHour,
  sumProfit,
  sumRevenue,
  sumReceivedRevenue,
  totalStock,
  uniqueCustomerCount,
  productStatsFromItems,
  percentageOf,
} from "./aggregates";
import {
  fetchItemsForSales,
  fetchScopedProducts,
  fetchScopedSales,
  loadRankingsDataset,
} from "./queries";
import type {
  DashboardMetricsResult,
  DayReportResult,
  ProjectionScenario,
  RankingsResult,
} from "./types";
import { buildOperationalDayMetrics } from "@/lib/operational-day-metrics";

export async function computeDashboardMetrics(
  businessId: string = ALL_BUSINESSES_ID,
): Promise<DashboardMetricsResult> {
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const { start: weekStart, end: weekEnd } = getWeekRange();
  const { start: monthStart, end: monthEnd } = getMonthRange();

  const [todaySales, yesterdaySales, weekSales, monthSales, metricsMap] = await Promise.all([
    fetchScopedSales({ businessId, dateEq: today }),
    fetchScopedSales({ businessId, dateEq: yesterday }),
    fetchScopedSales({ businessId, dateGte: weekStart }),
    fetchScopedSales({ businessId, dateGte: monthStart }),
    buildOperationalDayMetrics(businessId).catch(() => null),
  ]);

  const days = metricsMap ? Array.from(metricsMap.values()) : [];
  const dayOf = (date: string) => days.find((d) => d.date === date);

  const revenueToday = dayOf(today)?.revenue ?? sumReceivedRevenue(todaySales);
  const profitToday = dayOf(today)?.profit ?? sumProfit(todaySales);
  const revenueWeek = days.length
    ? days
        .filter((d) => d.date >= weekStart && d.date <= weekEnd)
        .reduce((sum, d) => sum + d.revenue, 0)
    : sumReceivedRevenue(weekSales);
  const revenueMonth = days.length
    ? days
        .filter((d) => d.date >= monthStart && d.date <= monthEnd)
        .reduce((sum, d) => sum + d.revenue, 0)
    : sumReceivedRevenue(monthSales);
  const revenueYesterday = dayOf(yesterday)?.revenue ?? sumReceivedRevenue(yesterdaySales);

  const todaySaleIds = todaySales.map((s) => s.id).filter(Boolean) as string[];
  const todayItems = await fetchItemsForSales(todaySaleIds);
  const itemsSoldToday = dayOf(today)?.units ?? itemsSoldFromItems(todayItems);

  const productRows = await fetchScopedProducts(businessId);
  const currentStock = totalStock(productRows);
  const dailyGoal = await getDailyGoalTarget(businessId);
  const progress = computeGoalProgress(revenueToday, dailyGoal);
  const customersToday = uniqueCustomerCount(todaySales);
  const payments = paymentBreakdown(todaySales);

  return {
    revenueToday,
    profitToday,
    revenueWeek,
    revenueMonth,
    itemsSoldToday,
    currentStock,
    dailyGoal,
    goalProgress: progress,
    customersToday,
    pixTotal: payments.pix,
    cardTotal: payments.card,
    cashTotal: payments.cash,
    averageTicket: averageTicket(revenueToday, todaySales.length),
    growthVsYesterday: computeGrowth(revenueToday, revenueYesterday),
  };
}

export async function computeDayReport(
  date: string,
  businessId: string = ALL_BUSINESSES_ID,
): Promise<DayReportResult> {
  const [daySales, metricsMap] = await Promise.all([
    fetchScopedSales({ businessId, dateEq: date }),
    buildOperationalDayMetrics(businessId).catch(() => null),
  ]);
  const saleIds = daySales.map((s) => s.id).filter(Boolean) as string[];
  const allItems = await fetchItemsForSales(saleIds);
  const allProducts = await fetchScopedProducts(ALL_BUSINESSES_ID);
  const productMap = new Map(allProducts.map((p) => [p.id, p.name]));
  const dayMetrics = metricsMap?.get(date);

  const revenue = dayMetrics?.revenue ?? sumRevenue(daySales);
  const profit = dayMetrics?.profit ?? sumProfit(daySales);
  const itemsSold = dayMetrics?.units ?? itemsSoldFromItems(allItems);
  const payments = paymentBreakdown(daySales);
  const productBreakdown = flavorQuantityBreakdown(allItems, (id) => productMap.get(id) ?? "Desconhecido");

  return {
    date,
    revenue,
    profit,
    itemsSold,
    salesCount: daySales.length,
    averageTicket: averageTicket(revenue, daySales.length),
    paymentBreakdown: payments,
    productBreakdown,
    sales: daySales,
  };
}

export async function computeRankings(
  businessId: string = ALL_BUSINESSES_ID,
): Promise<RankingsResult> {
  const { sales: allSales, items: allItems, products: allProducts, clients: allClients } =
    await loadRankingsDataset(businessId);

  const productMap = new Map(allProducts.map((p) => [p.id, p]));
  const clientMap = new Map(allClients.map((c) => [c.id, c]));

  const productSales: Record<
    string,
    { name: string; quantity: number; revenue: number; profit: number }
  > = {};
  for (const item of allItems) {
    const product = productMap.get(item.productId);
    if (!product || isUnidentifiedFlavorProduct(product.name)) continue;
    if (!productSales[product.id]) {
      productSales[product.id] = { name: product.name, quantity: 0, revenue: 0, profit: 0 };
    }
    productSales[product.id].quantity += item.quantity;
    productSales[product.id].revenue += item.subtotal ?? 0;
    productSales[product.id].profit += item.profit ?? 0;
  }

  const clientPurchases: Record<
    string,
    { name: string; count: number; total: number; favorite: string }
  > = {};
  for (const sale of allSales) {
    if (!sale.clientId) continue;
    const client = clientMap.get(sale.clientId);
    if (!client) continue;
    if (!clientPurchases[client.id]) {
      clientPurchases[client.id] = { name: client.name, count: 0, total: 0, favorite: "" };
    }
    clientPurchases[client.id].count += 1;
    clientPurchases[client.id].total += sale.totalAmount;
  }

  for (const [clientId, data] of Object.entries(clientPurchases)) {
    const clientSaleIds = allSales.filter((s) => s.clientId === clientId).map((s) => s.id);
    const clientItems = allItems.filter((i) => clientSaleIds.includes(i.saleId));
    const productCounts: Record<string, number> = {};
    for (const item of clientItems) {
      const product = productMap.get(item.productId);
      if (product && !isUnidentifiedFlavorProduct(product.name)) {
        productCounts[product.name] = (productCounts[product.name] ?? 0) + item.quantity;
      }
    }
    data.favorite = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  }

  const dayRevenue = revenueByDate(allSales);
  const hourSales = salesCountByHour(allSales);
  const shiftSales: Record<"morning" | "afternoon", number> = { morning: 0, afternoon: 0 };
  for (const [hour, count] of Object.entries(hourSales)) {
    shiftSales[shiftFromHour(parseInt(hour, 10))] += count;
  }
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const dayOfWeekSales = revenueByDayOfWeek(allSales, (date) => getDay(parseISO(date)));

  return {
    topProducts: Object.values(productSales).sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    topClients: Object.values(clientPurchases).sort((a, b) => b.total - a.total).slice(0, 10),
    bestDays: Object.entries(dayRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([d, revenue]) => ({ date: d, revenue })),
    bestHours: (["morning", "afternoon"] as const)
      .map((shift) => ({ hour: SHIFT_LABEL[shift], count: shiftSales[shift] }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count),
    bestDaysOfWeek: Object.entries(dayOfWeekSales)
      .sort((a, b) => b[1] - a[1])
      .map(([dow, revenue]) => ({ day: dayNames[parseInt(dow, 10)], revenue })),
    highestRevenue: Object.entries(dayRevenue).sort((a, b) => b[1] - a[1])[0],
    highestProfit: [...allSales].sort((a, b) => b.profit - a.profit)[0],
    highestTicket: [...allSales].sort((a, b) => b.totalAmount - a.totalAmount)[0],
  };
}

export interface ProductCatalogStat {
  productId: string;
  soldQuantity: number;
  revenueGenerated: number;
  salesShare: number;
  lastSaleDate: string | null;
}

export async function computeProductCatalogStats(
  businessId: string = ALL_BUSINESSES_ID,
): Promise<ProductCatalogStat[]> {
  const { sales: allSales, items: allItems, products: allProducts } =
    await loadRankingsDataset(businessId);
  const productMap = new Map(allProducts.map((p) => [p.id, p]));
  const stats = productStatsFromItems(allItems, (id) => productMap.get(id));
  const totalQty = stats.reduce((s, r) => s + r.quantity, 0);

  const lastSaleByProduct = new Map<string, string>();
  for (const sale of allSales) {
    for (const item of allItems.filter((i) => i.saleId === sale.id)) {
      const current = lastSaleByProduct.get(item.productId);
      if (!current || sale.date > current) {
        lastSaleByProduct.set(item.productId, sale.date);
      }
    }
  }

  return allProducts.map((p) => {
    const stat = stats.find((s) => s.productId === p.id);
    const qty = stat?.quantity ?? 0;
    return {
      productId: p.id,
      soldQuantity: qty,
      revenueGenerated: stat?.revenue ?? 0,
      salesShare: percentageOf(qty, totalQty),
      lastSaleDate: lastSaleByProduct.get(p.id) ?? null,
    };
  });
}

export async function computeProjections(
  businessId: string = ALL_BUSINESSES_ID,
): Promise<ProjectionScenario[]> {
  const dailyScenarios = [10, 15, 20, 25, 30, 40, 50];
  const productRows = await fetchScopedProducts(businessId);
  const avgPrice = averageProductPrice(productRows);
  const avgCost = averageProductCost(productRows);
  const avgProfit = avgPrice - avgCost;
  const workingDays = 22;

  return dailyScenarios.map((units) => ({
    dailyUnits: units,
    monthlyRevenue: units * avgPrice * workingDays,
    monthlyProfit: units * avgProfit * workingDays,
    monthlyUnits: units * workingDays,
  }));
}

export function computeCalendarDayStatus(
  revenue: number,
  target: number,
): "hit" | "close" | "miss" {
  const progress = goalProgress(revenue, target);
  if (progress >= 100) return "hit";
  if (progress >= 70) return "close";
  return "miss";
}
