import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  buildOperationalDayMetrics,
  sortOperationalDays,
} from "@/lib/operational-day-metrics";

export interface ProfitBankDay {
  date: string;
  label: string;
  revenue: number;
  profit: number;
  costs: number;
  saved: number;
  balance: number;
}

export interface ProfitBankView {
  currentBalance: number;
  totalRevenue: number;
  totalProfit: number;
  totalCosts: number;
  operationalDays: number;
  avgDailyProfit: number;
  bestDay: { date: string; profit: number } | null;
  history: ProfitBankDay[];
}

export async function getProfitBankView(businessId: string): Promise<ProfitBankView> {
  const metricsMap = await buildOperationalDayMetrics(businessId);
  const rows = sortOperationalDays(metricsMap);

  let balance = 0;
  let bestDay: { date: string; profit: number } | null = null;

  const history: ProfitBankDay[] = rows.map((row) => {
    balance += row.profit;
    if (!bestDay || row.profit > bestDay.profit) {
      bestDay = { date: row.date, profit: row.profit };
    }
    return {
      date: row.date,
      label: format(parseISO(row.date), "dd/MM", { locale: ptBR }),
      revenue: row.revenue,
      profit: row.profit,
      costs: row.costs,
      saved: row.profit,
      balance,
    };
  });

  const totalRevenue = history.reduce((s, d) => s + d.revenue, 0);
  const totalProfit = history.reduce((s, d) => s + d.profit, 0);
  const totalCosts = history.reduce((s, d) => s + d.costs, 0);

  return {
    currentBalance: balance,
    totalRevenue,
    totalProfit,
    totalCosts,
    operationalDays: history.length,
    avgDailyProfit: history.length > 0 ? totalProfit / history.length : 0,
    bestDay,
    history,
  };
}
