/**
 * Consultas reutilizáveis — carrega dados escopados por operação (SQLite + PostgreSQL).
 */
import { ALL_BUSINESSES_ID } from "@/lib/business-units";
import type { KpiDataset } from "./types";
import {
  fetchMetricClients,
  fetchMetricGoals,
  fetchMetricProducts,
  fetchMetricSaleItems,
  fetchMetricSales,
  type ScopedSalesQuery,
} from "@/platform/db/data-access/metrics";

export type { ScopedSalesQuery };

export async function fetchScopedSales(query: ScopedSalesQuery = {}) {
  return fetchMetricSales(query);
}

export async function fetchScopedProducts(businessId: string = ALL_BUSINESSES_ID) {
  return fetchMetricProducts(businessId);
}

export async function fetchActiveProducts(businessId: string = ALL_BUSINESSES_ID) {
  return fetchMetricProducts(businessId, true);
}

export async function fetchItemsForSales(saleIds: string[]) {
  return fetchMetricSaleItems(saleIds);
}

export async function fetchAllClients() {
  return fetchMetricClients();
}

export interface RankingsDataset {
  sales: Awaited<ReturnType<typeof fetchScopedSales>>;
  items: Awaited<ReturnType<typeof fetchItemsForSales>>;
  products: Awaited<ReturnType<typeof fetchScopedProducts>>;
  clients: Awaited<ReturnType<typeof fetchAllClients>>;
}

export async function loadRankingsDataset(
  businessId: string = ALL_BUSINESSES_ID,
): Promise<RankingsDataset> {
  const scopedSales = await fetchScopedSales({ businessId });
  const saleIds = scopedSales.map((s) => s.id).filter(Boolean) as string[];
  return {
    sales: scopedSales,
    items: await fetchItemsForSales(saleIds),
    products: await fetchScopedProducts(businessId),
    clients: await fetchAllClients(),
  };
}

export async function loadMonthSalesDataset(businessId: string, monthStart: string) {
  const scopedSales = await fetchScopedSales({ businessId, dateGte: monthStart });
  const saleIds = scopedSales.map((s) => s.id).filter(Boolean) as string[];
  const items = await fetchItemsForSales(saleIds);
  const productsList = await fetchScopedProducts(businessId);
  return { sales: scopedSales, items, products: productsList };
}

export async function loadKpiDataset(
  businessId: string = ALL_BUSINESSES_ID,
  period?: { start?: string; end?: string },
): Promise<KpiDataset> {
  const query: ScopedSalesQuery = { businessId };
  if (period?.start) query.dateGte = period.start;
  if (period?.end) query.dateLte = period.end;

  const scopedSales = await fetchScopedSales(query);
  const saleIds = scopedSales.map((s) => s.id).filter(Boolean) as string[];

  return {
    businessId,
    period: { start: period?.start ?? null, end: period?.end ?? null },
    sales: scopedSales,
    items: await fetchItemsForSales(saleIds),
    products: await fetchScopedProducts(businessId),
  };
}

export async function fetchScopedGoals(businessId: string = ALL_BUSINESSES_ID) {
  return fetchMetricGoals(businessId);
}
