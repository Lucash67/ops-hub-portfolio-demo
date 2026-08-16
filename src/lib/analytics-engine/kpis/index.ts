import { ALL_BUSINESSES_ID } from "@/lib/business-units";
import { loadKpiDataset } from "../queries";
import type { ExecutiveKpis, KpiPeriod } from "../types";
import { computeClientKpis } from "./client-kpis";
import { computeGoalKpis } from "./goal-kpis";
import { computeOperationKpis } from "./operation-kpis";
import { computePerformanceKpis } from "./performance-kpis";
import { computeProductKpis } from "./product-kpis";
import { computeRevenueKpis } from "./revenue-kpis";

export async function computeExecutiveKpis(
  businessId: string = ALL_BUSINESSES_ID,
  period?: KpiPeriod,
): Promise<ExecutiveKpis> {
  const dataset = await loadKpiDataset(businessId, period);

  return {
    businessId: dataset.businessId,
    period: dataset.period,
    revenue: computeRevenueKpis(dataset),
    clients: computeClientKpis(dataset),
    products: computeProductKpis(dataset),
    operations: computeOperationKpis(dataset),
    performance: await computePerformanceKpis(businessId, dataset),
    goals: await computeGoalKpis(businessId, dataset),
  };
}

export { computeRevenueKpis } from "./revenue-kpis";
export { computeClientKpis } from "./client-kpis";
export { computeProductKpis } from "./product-kpis";
export { computeOperationKpis } from "./operation-kpis";
export { computePerformanceKpis } from "./performance-kpis";
export { computeGoalKpis } from "./goal-kpis";
