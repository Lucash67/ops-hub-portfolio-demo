/** Tipos compartilhados do Analytics Engine — sem dependência de React ou páginas. */

export interface MetricSale {
  id?: string;
  date: string;
  time?: string;
  clientId?: string | null;
  paymentMethod?: string;
  paymentStatus?: "paid" | "pending" | "partial" | string | null;
  amountReceived?: number | null;
  totalAmount: number;
  profit: number;
  totalCost?: number;
  department?: string | null;
  businessId?: string;
}

export interface MetricSaleItem {
  saleId?: string;
  productId: string;
  quantity: number;
  subtotal?: number;
  profit?: number;
  product?: { id: string; name: string } | null;
}

export interface MetricProduct {
  id: string;
  name: string;
  price: number;
  cost: number;
  stockQuantity: number;
  minStock?: number;
  businessId?: string;
  status?: string;
}

export interface PaymentBreakdown {
  pix: number;
  card: number;
  cash: number;
}

export interface PeriodMetrics {
  revenue: number;
  profit: number;
  salesCount: number;
  itemsSold: number;
  averageTicket: number;
  uniqueCustomers: number;
  paymentBreakdown: PaymentBreakdown;
}

export interface DashboardMetricsResult {
  revenueToday: number;
  profitToday: number;
  revenueWeek: number;
  revenueMonth: number;
  itemsSoldToday: number;
  currentStock: number;
  dailyGoal: number;
  goalProgress: number;
  customersToday: number;
  pixTotal: number;
  cardTotal: number;
  cashTotal: number;
  averageTicket: number;
  growthVsYesterday: number;
}

export interface ProductQuantityStat {
  name: string;
  quantity: number;
  revenue: number;
  profit: number;
}

export interface RankingsResult {
  topProducts: ProductQuantityStat[];
  topClients: Array<{ name: string; count: number; total: number; favorite: string }>;
  bestDays: Array<{ date: string; revenue: number }>;
  bestHours: Array<{ hour: string; count: number }>;
  bestDaysOfWeek: Array<{ day: string; revenue: number }>;
  highestRevenue?: [string, number];
  highestProfit?: MetricSale;
  highestTicket?: MetricSale;
}

export interface DayReportResult {
  date: string;
  revenue: number;
  profit: number;
  itemsSold: number;
  salesCount: number;
  averageTicket: number;
  paymentBreakdown: PaymentBreakdown;
  productBreakdown: Record<string, number>;
  sales: MetricSale[];
}

export interface ProjectionScenario {
  dailyUnits: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  monthlyUnits: number;
}

/** Período para cálculo de KPIs executivos. */
export interface KpiPeriod {
  start?: string;
  end?: string;
}

/** Dataset escopado carregado uma única vez para KPIs. */
export interface KpiDataset {
  businessId: string;
  period: { start: string | null; end: string | null };
  sales: MetricSale[];
  items: MetricSaleItem[];
  products: MetricProduct[];
}

export interface RevenueKpis {
  total: number;
  byOperation: Array<{ businessId: string; revenue: number; share: number }>;
  dailyAverage: number;
  operationalDays: number;
}

export interface ClientKpis {
  unique: number;
  recurring: number;
  recurrenceRate: number;
  averageTicketPerClient: number;
}

export interface ProductShareKpi {
  name: string;
  quantity: number;
  revenue: number;
  quantityShare: number;
  revenueShare: number;
  abcClass: "A" | "B" | "C";
}

export interface ProductKpis {
  champion: { name: string; quantity: number } | null;
  lowest: { name: string; quantity: number } | null;
  shares: ProductShareKpi[];
  abcCurve: { A: number; B: number; C: number };
}

export interface OperationKpis {
  highestRevenue: { businessId: string; revenue: number } | null;
  highestTicket: { businessId: string; averageTicket: number } | null;
  participation: Array<{ businessId: string; revenue: number; share: number }>;
}

export interface PerformanceKpis {
  dailyGrowth: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  averageSalesPerDay: number;
  averageItemsPerSale: number;
}

export interface GoalKpiEntry {
  type: string;
  targetAmount: number;
  current: number;
  percentAchieved: number;
  remaining: number;
  requiredDailyPace: number;
  daysRemaining: number;
}

export interface GoalKpis {
  entries: GoalKpiEntry[];
}

export interface ExecutiveKpis {
  businessId: string;
  period: { start: string | null; end: string | null };
  revenue: RevenueKpis;
  clients: ClientKpis;
  products: ProductKpis;
  operations: OperationKpis;
  performance: PerformanceKpis;
  goals: GoalKpis;
}
