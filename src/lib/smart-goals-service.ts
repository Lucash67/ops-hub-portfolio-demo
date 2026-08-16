import { format, subMonths } from "date-fns";
import {
  fetchActiveProducts,
  fetchItemsForSales,
  fetchScopedSales,
} from "@/lib/analytics-engine/queries";
import { sumPendingRevenue } from "@/lib/analytics-engine/client";
import { isAllBusinesses } from "@/lib/business-units";
import { getDiaryEntry } from "@/lib/diary-service";
import { buildOperationalDayMetrics } from "@/lib/operational-day-metrics";
import { fetchMetricGoals } from "@/platform/db/data-access/metrics";
import {
  buildSmartGoalsView,
  type SmartGoalsView,
  type StoredGoalTarget,
} from "@/lib/smart-goals-view";

export async function getSmartGoalsView(
  businessId: string,
  referenceDate?: string,
): Promise<SmartGoalsView | null> {
  if (isAllBusinesses(businessId)) return null;

  const metricsMap = await buildOperationalDayMetrics(businessId).catch(() => null);
  const lastOperationalDate = metricsMap
    ? Array.from(metricsMap.keys()).sort().at(-1)
    : undefined;

  // Sem data explícita, ancora no último dia operacional com dados (evita "hoje" vazio).
  const today = format(new Date(), "yyyy-MM-dd");
  const ref =
    referenceDate ??
    (lastOperationalDate && lastOperationalDate <= today ? lastOperationalDate : today);
  const from = format(subMonths(new Date(ref), 3), "yyyy-MM-dd");

  const [scopedSales, products, diary, goalRows] = await Promise.all([
    fetchScopedSales({ businessId, dateGte: from, dateLte: ref }),
    fetchActiveProducts(businessId),
    getDiaryEntry(businessId, ref),
    fetchMetricGoals(businessId),
  ]);
  const saleIds = scopedSales.map((s) => s.id).filter(Boolean) as string[];
  const items = await fetchItemsForSales(saleIds);
  const productMap = new Map(products.map((p) => [p.id, p.name]));

  const dayMetrics = metricsMap
    ? Array.from(metricsMap.values()).filter((d) => d.date >= from && d.date <= ref)
    : undefined;

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const totalRevenue = scopedSales.reduce((s, v) => s + v.totalAmount, 0);
  const avgPrice = totalUnits > 0 ? totalRevenue / totalUnits : 5;

  const totalCost = products.reduce((s, p) => s + (p.cost ?? 0), 0);
  const avgCost = products.length > 0 ? totalCost / products.length : 3.75;

  const pendingRevenue = sumPendingRevenue(scopedSales.filter((s) => s.date === ref));

  const storedGoals: StoredGoalTarget[] = goalRows
    .filter((g) => g.type === "daily" || g.type === "weekly" || g.type === "monthly" || g.type === "yearly")
    .map((g) => ({
      id: g.id,
      type: g.type as StoredGoalTarget["type"],
      targetAmount: g.targetAmount,
      targetUnits: g.targetUnits ?? null,
    }));

  return buildSmartGoalsView({
    businessId,
    referenceDate: ref,
    sales: scopedSales.map((s) => ({
      id: s.id,
      date: s.date,
      time: s.time ?? "12:00",
      totalAmount: s.totalAmount,
      amountReceived: s.amountReceived,
      paymentStatus: s.paymentStatus,
      profit: s.profit,
    })),
    items: items.map((i) => ({
      saleId: i.saleId,
      productId: i.productId,
      quantity: i.quantity,
    })),
    productNameById: (id) => productMap.get(id) ?? "Produto",
    avgPrice,
    avgCost,
    pendingRevenue,
    diaryInsights: diary
      ? {
          manualInsights: diary.manualInsights,
          lossReason: diary.lossReason,
          dailyGoalUnits: diary.dailyGoalUnits,
        }
      : undefined,
    dayMetrics,
    storedGoals,
  });
}
