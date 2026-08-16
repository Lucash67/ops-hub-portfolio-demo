/**
 * Analytics Engine — única fonte oficial de métricas do LH Hub.
 *
 * Regras:
 * - Sem dependência de React, páginas ou hooks
 * - Parâmetros explícitos (businessId, datas, períodos)
 * - Consultas reutilizáveis via queries.ts
 * - Agregações puras via aggregates.ts
 *
 * ATENÇÃO: componentes client ("use client") devem importar de ./client ou ./aggregates,
 * nunca deste index — queries/compute acessam o banco via platform/db (Node.js only).
 */
export type {
  MetricSale,
  MetricSaleItem,
  MetricProduct,
  PaymentBreakdown,
  PeriodMetrics,
  DashboardMetricsResult,
  ProductQuantityStat,
  RankingsResult,
  DayReportResult,
  ProjectionScenario,
  KpiPeriod,
  KpiDataset,
  RevenueKpis,
  ClientKpis,
  ProductShareKpi,
  ProductKpis,
  OperationKpis,
  PerformanceKpis,
  GoalKpiEntry,
  GoalKpis,
  ExecutiveKpis,
} from "./types";

export {
  sumRevenue,
  sumProfit,
  countSales,
  uniqueCustomerCount,
  averageTicket,
  paymentBreakdown,
  itemsSoldFromEmbedded,
  itemsSoldFromItems,
  computePeriodMetrics,
  productQuantityBreakdown,
  productQuantityBreakdownFromEmbedded,
  flavorQuantityBreakdown,
  flavorQuantityBreakdownFromEmbedded,
  topProductByQuantity,
  bottomProductByQuantity,
  computeGoalProgress,
  computeGrowth,
  revenueByDate,
  salesCountByHour,
  revenueByDayOfWeek,
  totalStock,
  averageProductPrice,
  averageProductCost,
  distinctOperationalDays,
  percentageOf,
  productStatsFromItems,
  groupRevenueByField,
  recurringCustomerCount,
} from "./aggregates";
export type { ProductStatRow } from "./aggregates";

export {
  fetchScopedSales,
  fetchScopedProducts,
  fetchActiveProducts,
  fetchItemsForSales,
  fetchAllClients,
  loadRankingsDataset,
  loadMonthSalesDataset,
  loadKpiDataset,
  fetchScopedGoals,
} from "./queries";
export type { ScopedSalesQuery, RankingsDataset } from "./queries";

export {
  computeDashboardMetrics,
  computeDayReport,
  computeRankings,
  computeProductCatalogStats,
  computeProjections,
  computeCalendarDayStatus,
} from "./compute";
export type { ProductCatalogStat } from "./compute";

export {
  computeExecutiveKpis,
  computeRevenueKpis,
  computeClientKpis,
  computeProductKpis,
  computeOperationKpis,
  computePerformanceKpis,
  computeGoalKpis,
} from "./kpis";
