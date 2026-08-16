import { averageTicket, groupRevenueByField, percentageOf, sumRevenue } from "../aggregates";
import { ALL_BUSINESSES_ID } from "@/lib/business-units";
import type { KpiDataset, OperationKpis } from "../types";

export function computeOperationKpis(dataset: KpiDataset): OperationKpis {
  const total = sumRevenue(dataset.sales);

  if (dataset.businessId !== ALL_BUSINESSES_ID) {
    const ticket = averageTicket(total, dataset.sales.length);
    const entry = {
      businessId: dataset.businessId,
      revenue: total,
      share: total > 0 ? 100 : 0,
    };
    return {
      highestRevenue: total > 0 ? { businessId: dataset.businessId, revenue: total } : null,
      highestTicket: ticket > 0 ? { businessId: dataset.businessId, averageTicket: ticket } : null,
      participation: total > 0 ? [entry] : [],
    };
  }

  const byOp = groupRevenueByField(dataset.sales, "businessId");

  const participation = Object.entries(byOp)
    .map(([businessId, revenue]) => ({
      businessId,
      revenue,
      share: percentageOf(revenue, total),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  let highestTicket: OperationKpis["highestTicket"] = null;
  for (const [businessId] of Object.entries(byOp)) {
    const opSales = dataset.sales.filter((s) => s.businessId === businessId);
    const ticket = averageTicket(sumRevenue(opSales), opSales.length);
    if (!highestTicket || ticket > highestTicket.averageTicket) {
      highestTicket = { businessId, averageTicket: ticket };
    }
  }

  const top = participation[0];
  return {
    highestRevenue: top ? { businessId: top.businessId, revenue: top.revenue } : null,
    highestTicket,
    participation,
  };
}
