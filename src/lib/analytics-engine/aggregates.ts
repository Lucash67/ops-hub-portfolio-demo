/**
 * Funções puras de agregação — única fonte para cálculos de métricas.
 * Sem acesso a banco, hooks ou componentes.
 */
import { calcGrowth, goalProgress } from "@/lib/utils";
import { excludeUnidentifiedFlavors } from "@/lib/salgados-flavors";
import type { MetricSale, MetricSaleItem, PaymentBreakdown, PeriodMetrics } from "./types";

export function sumRevenue(sales: Array<{ totalAmount: number }>): number {
  return sales.reduce((s, v) => s + v.totalAmount, 0);
}

/** Receita efetivamente recebida — exclui fiado/pendente. */
export function saleReceivedAmount(sale: {
  totalAmount: number;
  amountReceived?: number | null;
  paymentStatus?: string | null;
}): number {
  if (sale.amountReceived != null) return sale.amountReceived;
  if (sale.paymentStatus === "pending") return 0;
  if (sale.paymentStatus === "partial") return 0;
  return sale.totalAmount;
}

export function sumReceivedRevenue(
  sales: Array<{
    totalAmount: number;
    amountReceived?: number | null;
    paymentStatus?: string | null;
  }>,
): number {
  return sales.reduce((s, v) => s + saleReceivedAmount(v), 0);
}

export function sumPendingRevenue(
  sales: Array<{
    totalAmount: number;
    amountReceived?: number | null;
    paymentStatus?: string | null;
  }>,
): number {
  return sales.reduce((s, v) => s + Math.max(0, v.totalAmount - saleReceivedAmount(v)), 0);
}

export function sumProfit(sales: Array<{ profit: number }>): number {
  return sales.reduce((s, v) => s + v.profit, 0);
}

export function countSales(sales: unknown[]): number {
  return sales.length;
}

export function uniqueCustomerCount(sales: Array<{ clientId?: string | null }>): number {
  return new Set(sales.map((s) => s.clientId).filter(Boolean)).size;
}

export function averageTicket(revenue: number, salesCount: number): number {
  return salesCount > 0 ? revenue / salesCount : 0;
}

export function paymentBreakdown(
  sales: Array<{
    paymentMethod?: string;
    totalAmount: number;
    amountReceived?: number | null;
    paymentStatus?: string | null;
  }>,
): PaymentBreakdown {
  const amount = (s: (typeof sales)[number]) => saleReceivedAmount(s);
  return {
    pix: sales.filter((s) => s.paymentMethod === "pix").reduce((s, v) => s + amount(v), 0),
    card: sales.filter((s) => s.paymentMethod === "card").reduce((s, v) => s + amount(v), 0),
    cash: sales.filter((s) => s.paymentMethod === "cash").reduce((s, v) => s + amount(v), 0),
  };
}

export function itemsSoldFromEmbedded(sales: Array<{ items?: Array<{ quantity: number }> }>): number {
  return sales.reduce(
    (sum, sale) => sum + (sale.items?.reduce((s, item) => s + item.quantity, 0) ?? 0),
    0,
  );
}

export function itemsSoldFromItems(items: Array<{ quantity: number }>): number {
  return items.reduce((s, i) => s + i.quantity, 0);
}

export function computePeriodMetrics(
  sales: MetricSale[],
  items: MetricSaleItem[] = [],
): PeriodMetrics {
  const revenue = sumRevenue(sales);
  const profit = sumProfit(sales);
  const salesCount = countSales(sales);
  const itemsSold = items.length > 0 ? itemsSoldFromItems(items) : 0;

  return {
    revenue,
    profit,
    salesCount,
    itemsSold,
    averageTicket: averageTicket(revenue, salesCount),
    uniqueCustomers: uniqueCustomerCount(sales),
    paymentBreakdown: paymentBreakdown(sales),
  };
}

export function productQuantityBreakdown(
  items: MetricSaleItem[],
  resolveName: (productId: string) => string,
): Record<string, number> {
  const breakdown: Record<string, number> = {};
  for (const item of items) {
    const name = resolveName(item.productId);
    breakdown[name] = (breakdown[name] ?? 0) + item.quantity;
  }
  return breakdown;
}

export function productQuantityBreakdownFromEmbedded(
  sales: Array<{ items?: MetricSaleItem[] }>,
): Record<string, number> {
  const breakdown: Record<string, number> = {};
  for (const sale of sales) {
    for (const item of sale.items ?? []) {
      const name = item.product?.name ?? "Desconhecido";
      breakdown[name] = (breakdown[name] ?? 0) + item.quantity;
    }
  }
  return breakdown;
}

/** Breakdown de sabores para gráficos — exclui vendas sem sabor identificado. */
export function flavorQuantityBreakdownFromEmbedded(
  sales: Array<{ items?: MetricSaleItem[] }>,
): Record<string, number> {
  return excludeUnidentifiedFlavors(productQuantityBreakdownFromEmbedded(sales));
}

export function flavorQuantityBreakdown(
  items: MetricSaleItem[],
  resolveName: (productId: string) => string,
): Record<string, number> {
  return excludeUnidentifiedFlavors(productQuantityBreakdown(items, resolveName));
}

export function topProductByQuantity(
  quantityMap: Record<string, number>,
): [string, number] | undefined {
  const sorted = Object.entries(quantityMap).sort((a, b) => b[1] - a[1]);
  return sorted[0];
}

export function bottomProductByQuantity(
  quantityMap: Record<string, number>,
): [string, number] | undefined {
  const sorted = Object.entries(quantityMap).sort((a, b) => a[1] - b[1]);
  return sorted[0];
}

export function computeGoalProgress(revenue: number, target: number): number {
  return goalProgress(revenue, target);
}

export function computeGrowth(current: number, previous: number): number {
  return calcGrowth(current, previous);
}

export function revenueByDate(sales: MetricSale[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const sale of sales) {
    map[sale.date] = (map[sale.date] ?? 0) + sale.totalAmount;
  }
  return map;
}

export function salesCountByHour(sales: Array<{ time?: string }>): Record<number, number> {
  const map: Record<number, number> = {};
  for (const sale of sales) {
    if (!sale.time) continue;
    const hour = parseInt(sale.time.split(":")[0], 10);
    map[hour] = (map[hour] ?? 0) + 1;
  }
  return map;
}

export function revenueByDayOfWeek(
  sales: MetricSale[],
  getDayOfWeek: (date: string) => number,
): Record<number, number> {
  const map: Record<number, number> = {};
  for (const sale of sales) {
    const dow = getDayOfWeek(sale.date);
    map[dow] = (map[dow] ?? 0) + sale.totalAmount;
  }
  return map;
}

export function totalStock(products: Array<{ stockQuantity: number }>): number {
  return products.reduce((s, p) => s + p.stockQuantity, 0);
}

export function averageProductPrice(products: Array<{ price: number }>): number {
  return products.length > 0 ? products.reduce((s, p) => s + p.price, 0) / products.length : 0;
}

export function averageProductCost(products: Array<{ cost: number }>): number {
  return products.length > 0 ? products.reduce((s, p) => s + p.cost, 0) / products.length : 0;
}

export function distinctOperationalDays(sales: Array<{ date: string }>): number {
  return new Set(sales.map((s) => s.date)).size;
}

export function percentageOf(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

export interface ProductStatRow {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export function productStatsFromItems(
  items: MetricSaleItem[],
  resolveProduct: (productId: string) => { id: string; name: string } | undefined,
): ProductStatRow[] {
  const map = new Map<string, ProductStatRow>();
  for (const item of items) {
    const product = resolveProduct(item.productId);
    if (!product) continue;
    const existing = map.get(product.id);
    if (existing) {
      existing.quantity += item.quantity;
      existing.revenue += item.subtotal ?? 0;
    } else {
      map.set(product.id, {
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        revenue: item.subtotal ?? 0,
      });
    }
  }
  return Array.from(map.values());
}

export function groupRevenueByField(
  sales: MetricSale[],
  field: keyof Pick<MetricSale, "businessId">,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const sale of sales) {
    const key = String(sale[field] ?? "unknown");
    map[key] = (map[key] ?? 0) + sale.totalAmount;
  }
  return map;
}

export function recurringCustomerCount(
  sales: Array<{ clientId?: string | null }>,
  minPurchases = 2,
): number {
  const counts = new Map<string, number>();
  for (const sale of sales) {
    if (!sale.clientId) continue;
    counts.set(sale.clientId, (counts.get(sale.clientId) ?? 0) + 1);
  }
  return Array.from(counts.values()).filter((c) => c >= minPurchases).length;
}
