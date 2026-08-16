import { eq } from "drizzle-orm";
import { getPostgresDb } from "@/platform/db";
import { fromDbBusinessId } from "@/platform/db/business-id";
import { queryAll } from "@/platform/db/query";
import { fetchMetricSales } from "@/platform/db/data-access/metrics";
import { cashFlowEvents as pgCashFlow, dailyInvestments, operationDays } from "@/lib/db/postgres/schema";
import { ALL_BUSINESSES_ID, isAllBusinesses } from "@/lib/business-units";
import { computeDualFinancialView } from "./operator-finance";
import type {
  DualFinancialView,
  InvestmentFinanceRecord,
  InvestmentSourceType,
  OperatorCashFlowRecord,
  OperatorSaleRecord,
} from "./types";
import type { MetricSale } from "@/lib/analytics-engine/types";

function mapMetricSale(sale: MetricSale): OperatorSaleRecord {
  return {
    date: sale.date,
    totalAmount: sale.totalAmount,
    profit: sale.profit,
    totalCost: sale.totalCost ?? 0,
    paymentStatus: sale.paymentStatus ?? "paid",
    amountReceived: sale.amountReceived ?? null,
    paymentDate: null,
  };
}

async function loadScopedInvestments(businessId: string): Promise<InvestmentFinanceRecord[]> {
  const db = await getPostgresDb();
  const rows = await queryAll(
    db
      .select({ investment: dailyInvestments, day: operationDays })
      .from(dailyInvestments)
      .innerJoin(operationDays, eq(dailyInvestments.operationDayId, operationDays.id)),
  );

  return rows
    .filter((row) =>
      isAllBusinesses(businessId)
        ? true
        : fromDbBusinessId(row.day.businessId) === businessId,
    )
    .map((row) => ({
      id: row.investment.id,
      amount: Number(row.investment.amount),
      type: row.investment.investmentType,
      date: row.day.operationDate,
      description: row.investment.description,
      sourceType: row.investment.sourceType as InvestmentSourceType,
      sourceName: row.investment.sourceName ?? null,
      businessId: fromDbBusinessId(row.day.businessId),
    }));
}

async function loadSalesForOperatorCashIn(
  businessId: string,
  period?: { start?: string; end?: string },
): Promise<OperatorSaleRecord[]> {
  const scoped = await fetchMetricSales({
    businessId,
    dateGte: period?.start,
    dateLte: period?.end,
  });
  return scoped.map(mapMetricSale);
}

async function loadCashFlowForPeriod(
  period?: { start?: string; end?: string },
): Promise<OperatorCashFlowRecord[]> {
  const db = await getPostgresDb();
  const rows = await queryAll(db.select().from(pgCashFlow));
  return rows
    .filter((row) => {
      const date = row.eventDate;
      if (period?.start && date < period.start) return false;
      if (period?.end && date > period.end) return false;
      return true;
    })
    .map((row) => ({
      type: row.eventType,
      category: row.category,
      amount: Number(row.amount),
      date: row.eventDate,
    }));
}

export async function getDualFinancialView(
  businessId: string = ALL_BUSINESSES_ID,
  period?: { start?: string; end?: string },
): Promise<DualFinancialView> {
  const investmentRows = await loadScopedInvestments(businessId);
  const saleRows = await loadSalesForOperatorCashIn(businessId, period);
  const cashFlowRows = await loadCashFlowForPeriod(period);

  const scopedInvestments = period
    ? investmentRows.filter((i) => {
        if (period.start && i.date < period.start) return false;
        if (period.end && i.date > period.end) return false;
        return true;
      })
    : investmentRows;

  return computeDualFinancialView(saleRows, scopedInvestments, cashFlowRows, period);
}

export async function getDayDualFinancialView(
  date: string,
  businessId: string = ALL_BUSINESSES_ID,
): Promise<DualFinancialView> {
  return getDualFinancialView(businessId, { start: date, end: date });
}

export async function getInvestmentFinanceRecords(
  businessId: string = ALL_BUSINESSES_ID,
): Promise<InvestmentFinanceRecord[]> {
  return loadScopedInvestments(businessId);
}
