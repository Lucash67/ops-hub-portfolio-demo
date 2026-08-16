/**
 * Entrada client-safe do Analytics Engine.
 * Apenas agregações puras — sem banco, fs ou better-sqlite3.
 * Componentes React ("use client") devem importar daqui, nunca de index.ts.
 */
export type {
  MetricSale,
  MetricSaleItem,
  MetricProduct,
  PaymentBreakdown,
  PeriodMetrics,
} from "./types";

export {
  sumRevenue,
  sumReceivedRevenue,
  sumPendingRevenue,
  saleReceivedAmount,
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
} from "./aggregates";
