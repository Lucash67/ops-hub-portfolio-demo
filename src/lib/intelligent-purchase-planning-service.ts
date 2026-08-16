import { format, subMonths } from "date-fns";
import {
  fetchActiveProducts,
  fetchItemsForSales,
  fetchScopedSales,
} from "@/lib/analytics-engine/queries";
import { getDiaryEntry, listDiaryEntries } from "@/lib/diary-service";
import {
  planFromDistribution,
  planFromTotalUnits,
  suggestPurchasePlan,
  type ProductDistribution,
  type PurchasePlanSuggestion,
} from "@/lib/intelligent-purchase-planning-view";
import { isAllBusinesses } from "@/lib/business-units";

const FALLBACK_AVG_UNIT_COST = 3.67;

/** Média segura de custo/unidade a partir de compras do diário (ignora totalUnits <= 0). */
function averageUnitCostFromPurchases(
  diaries: Array<{ purchase?: { investment: number; totalUnits: number } | null }>,
): number {
  const costs = diaries
    .map((d) => d.purchase)
    .filter((p): p is { investment: number; totalUnits: number } => Boolean(p && p.totalUnits > 0))
    .map((p) => p.investment / p.totalUnits);
  if (costs.length === 0) return FALLBACK_AVG_UNIT_COST;
  return costs.reduce((s, c) => s + c, 0) / costs.length;
}

export interface PurchasePlanningResult {
  businessId: string;
  referenceDate: string;
  mode: "auto" | "manual_total" | "manual_distribution";
  suggestion: PurchasePlanSuggestion;
  recentDailyUnits: Array<{ date: string; units: number }>;
}

export async function getPurchasePlanSuggestion(
  businessId: string,
  referenceDate?: string,
): Promise<PurchasePlanningResult | null> {
  if (isAllBusinesses(businessId)) return null;

  const ref = referenceDate ?? format(new Date(), "yyyy-MM-dd");
  const from = format(subMonths(new Date(ref), 2), "yyyy-MM-dd");

  const sales = await fetchScopedSales({ businessId, dateGte: from, dateLte: ref });
  const saleIds = sales.map((s) => s.id).filter(Boolean) as string[];
  const items = await fetchItemsForSales(saleIds);
  const products = await fetchActiveProducts(businessId);
  const productMap = new Map(products.map((p) => [p.id, p.name]));

  const diaries = await listDiaryEntries(businessId, from, ref);
  const latestDiary = (await getDiaryEntry(businessId, ref)) ?? diaries[0];
  const combinedInsights = diaries
    .map((d) => `${d.manualInsights ?? ""} ${d.lessonsLearned ?? ""}`)
    .join(" ");

  const avgUnitCost = averageUnitCostFromPurchases(diaries);

  const input = {
    businessId,
    referenceDate: ref,
    sales: sales.map((s) => ({ id: s.id, date: s.date, time: s.time ?? "12:00" })),
    items: items.map((i) => ({ saleId: i.saleId, productId: i.productId, quantity: i.quantity })),
    productNameById: (id: string) => productMap.get(id) ?? "Produto",
    avgUnitCost,
    diaryInsights: {
      manualInsights: combinedInsights,
      lessonsLearned: latestDiary?.lessonsLearned,
      dailyGoalUnits: latestDiary?.dailyGoalUnits,
      morningGoalUnits: 8,
    },
  };

  const suggestion = suggestPurchasePlan(input);

  const itemsBySale = new Map<string, number>();
  for (const item of items) {
    if (!item.saleId) continue;
    itemsBySale.set(item.saleId, (itemsBySale.get(item.saleId) ?? 0) + item.quantity);
  }
  const dayUnits = new Map<string, number>();
  for (const sale of sales) {
    if (!sale.id) continue;
    dayUnits.set(sale.date, (dayUnits.get(sale.date) ?? 0) + (itemsBySale.get(sale.id) ?? 0));
  }

  return {
    businessId,
    referenceDate: ref,
    mode: "auto",
    suggestion,
    recentDailyUnits: Array.from(dayUnits.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7)
      .map(([date, units]) => ({ date, units })),
  };
}

export async function getPurchasePlanFromTotal(
  businessId: string,
  totalUnits: number,
  referenceDate?: string,
): Promise<PurchasePlanningResult | null> {
  const base = await getPurchasePlanSuggestion(businessId, referenceDate);
  if (!base) return null;

  const ref = referenceDate ?? format(new Date(), "yyyy-MM-dd");
  const from = format(subMonths(new Date(ref), 2), "yyyy-MM-dd");
  const sales = await fetchScopedSales({ businessId, dateGte: from, dateLte: ref });
  const saleIds = sales.map((s) => s.id).filter(Boolean) as string[];
  const items = await fetchItemsForSales(saleIds);
  const products = await fetchActiveProducts(businessId);
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const diaries = await listDiaryEntries(businessId, from, ref);
  const combinedInsights = diaries.map((d) => `${d.manualInsights ?? ""} ${d.lessonsLearned ?? ""}`).join(" ");
  const avgUnitCost = averageUnitCostFromPurchases(diaries);

  const input = {
    businessId,
    referenceDate: ref,
    sales: sales.map((s) => ({ id: s.id, date: s.date, time: s.time ?? "12:00" })),
    items: items.map((i) => ({ saleId: i.saleId, productId: i.productId, quantity: i.quantity })),
    productNameById: (id: string) => productMap.get(id) ?? "Produto",
    avgUnitCost,
    diaryInsights: { manualInsights: combinedInsights },
  };

  return {
    ...base,
    mode: "manual_total",
    suggestion: planFromTotalUnits(input, totalUnits),
  };
}

export async function getPurchasePlanFromDistribution(
  businessId: string,
  distribution: ProductDistribution,
  referenceDate?: string,
): Promise<(PurchasePlanningResult & { validation: ReturnType<typeof planFromDistribution>["validation"] }) | null> {
  const base = await getPurchasePlanSuggestion(businessId, referenceDate);
  if (!base) return null;

  const ref = referenceDate ?? format(new Date(), "yyyy-MM-dd");
  const from = format(subMonths(new Date(ref), 2), "yyyy-MM-dd");
  const sales = await fetchScopedSales({ businessId, dateGte: from, dateLte: ref });
  const saleIds = sales.map((s) => s.id).filter(Boolean) as string[];
  const items = await fetchItemsForSales(saleIds);
  const products = await fetchActiveProducts(businessId);
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const diaries = await listDiaryEntries(businessId, from, ref);
  const combinedInsights = diaries.map((d) => `${d.manualInsights ?? ""} ${d.lessonsLearned ?? ""}`).join(" ");
  const avgUnitCost = averageUnitCostFromPurchases(diaries);

  const input = {
    businessId,
    referenceDate: ref,
    sales: sales.map((s) => ({ id: s.id, date: s.date, time: s.time ?? "12:00" })),
    items: items.map((i) => ({ saleId: i.saleId, productId: i.productId, quantity: i.quantity })),
    productNameById: (id: string) => productMap.get(id) ?? "Produto",
    avgUnitCost,
    diaryInsights: { manualInsights: combinedInsights },
  };

  const result = planFromDistribution(input, distribution);
  return {
    ...base,
    mode: "manual_distribution",
    suggestion: result,
    validation: result.validation,
  };
}
