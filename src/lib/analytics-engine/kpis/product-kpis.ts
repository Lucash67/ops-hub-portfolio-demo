import {
  bottomProductByQuantity,
  itemsSoldFromItems,
  percentageOf,
  productStatsFromItems,
  topProductByQuantity,
} from "../aggregates";
import type { ProductStatRow } from "../aggregates";
import type { KpiDataset, ProductKpis, ProductShareKpi } from "../types";

function buildQuantityMap(stats: ProductStatRow[]): Record<string, number> {
  return Object.fromEntries(stats.map((s) => [s.name, s.quantity]));
}

function classifyAbc(stats: ProductStatRow[]): ProductShareKpi[] {
  const totalRevenue = stats.reduce((s, p) => s + p.revenue, 0);
  const totalQty = stats.reduce((s, p) => s + p.quantity, 0);
  const sorted = [...stats].sort((a, b) => b.revenue - a.revenue);

  let cumulative = 0;
  return sorted.map((row) => {
    const revenueShare = percentageOf(row.revenue, totalRevenue);
    cumulative += revenueShare;
    let abcClass: "A" | "B" | "C" = "C";
    if (cumulative <= 80 || (cumulative - revenueShare < 80 && cumulative >= 80)) {
      abcClass = "A";
    } else if (cumulative <= 95) {
      abcClass = "B";
    }

    return {
      name: row.name,
      quantity: row.quantity,
      revenue: row.revenue,
      quantityShare: percentageOf(row.quantity, totalQty),
      revenueShare,
      abcClass,
    };
  });
}

export function computeProductKpis(dataset: KpiDataset): ProductKpis {
  const productMap = new Map(dataset.products.map((p) => [p.id, p]));
  const stats = productStatsFromItems(dataset.items, (id) => productMap.get(id));
  const qtyMap = buildQuantityMap(stats);

  const top = topProductByQuantity(qtyMap);
  const bottom = bottomProductByQuantity(qtyMap);
  const shares = classifyAbc(stats);

  return {
    champion: top ? { name: top[0], quantity: top[1] } : null,
    lowest: bottom ? { name: bottom[0], quantity: bottom[1] } : null,
    shares,
    abcCurve: {
      A: shares.filter((s) => s.abcClass === "A").length,
      B: shares.filter((s) => s.abcClass === "B").length,
      C: shares.filter((s) => s.abcClass === "C").length,
    },
  };
}

export function totalItemsSold(dataset: KpiDataset): number {
  return itemsSoldFromItems(dataset.items);
}
