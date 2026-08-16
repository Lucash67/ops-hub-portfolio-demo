import { format, subDays } from "date-fns";
import { getMonthRange, getWeekRange } from "@/lib/utils";
import {
  averageTicket,
  computeGrowth,
  countSales,
  distinctOperationalDays,
  itemsSoldFromItems,
  sumRevenue,
} from "../aggregates";
import { fetchScopedSales } from "../queries";
import type { KpiDataset, PerformanceKpis } from "../types";

export async function computePerformanceKpis(
  businessId: string,
  dataset: KpiDataset,
): Promise<PerformanceKpis> {
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

  const todaySales = await fetchScopedSales({ businessId, dateEq: today });
  const yesterdaySales = await fetchScopedSales({ businessId, dateEq: yesterday });

  const { start: weekStart, end: weekEnd } = getWeekRange();
  const prevWeekEnd = format(subDays(new Date(weekStart), 1), "yyyy-MM-dd");
  const prevWeekStart = format(subDays(new Date(weekStart), 7), "yyyy-MM-dd");

  const thisWeek = await fetchScopedSales({ businessId, dateGte: weekStart, dateLte: weekEnd });
  const prevWeek = await fetchScopedSales({
    businessId,
    dateGte: prevWeekStart,
    dateLte: prevWeekEnd,
  });

  const { start: monthStart, end: monthEnd } = getMonthRange();
  const prevMonthEnd = format(subDays(new Date(monthStart), 1), "yyyy-MM-dd");
  const prevMonthStart = format(subDays(new Date(monthStart), 30), "yyyy-MM-dd");

  const thisMonth = await fetchScopedSales({ businessId, dateGte: monthStart, dateLte: monthEnd });
  const prevMonth = await fetchScopedSales({
    businessId,
    dateGte: prevMonthStart,
    dateLte: prevMonthEnd,
  });

  const operationalDays = distinctOperationalDays(dataset.sales);
  const salesCount = countSales(dataset.sales);
  const itemsSold = itemsSoldFromItems(dataset.items);

  return {
    dailyGrowth: computeGrowth(sumRevenue(todaySales), sumRevenue(yesterdaySales)),
    weeklyGrowth: computeGrowth(sumRevenue(thisWeek), sumRevenue(prevWeek)),
    monthlyGrowth: computeGrowth(sumRevenue(thisMonth), sumRevenue(prevMonth)),
    averageSalesPerDay: operationalDays > 0 ? salesCount / operationalDays : 0,
    averageItemsPerSale: salesCount > 0 ? itemsSold / salesCount : 0,
  };
}

export function averageTicketFromDataset(dataset: KpiDataset): number {
  return averageTicket(sumRevenue(dataset.sales), dataset.sales.length);
}
