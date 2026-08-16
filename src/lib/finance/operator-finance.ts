/**
 * Cálculos puros — operação vs operador.
 * Não altera lucro operacional; adiciona camada interpretativa.
 */
import {
  INVESTMENT_SOURCE_LABELS,
  type DualFinancialView,
  type InvestmentFinanceRecord,
  type InvestmentSourceType,
  type OperatorCashFlowRecord,
  type OperatorFinancialMetrics,
  type OperatorSaleRecord,
  type OperationFinancialMetrics,
  type ProfitReconciliation,
  type ProfitReconciliationReason,
} from "./types";

const EPSILON = 0.005;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function isOwnCapital(sourceType: InvestmentSourceType | null | undefined): boolean {
  return sourceType === "own_capital";
}

function activeInvestments(investments: InvestmentFinanceRecord[]): InvestmentFinanceRecord[] {
  return investments.filter((i) => i.type !== "withdrawal");
}

export function sumOperationalInvestment(investments: InvestmentFinanceRecord[]): number {
  return round(activeInvestments(investments).reduce((s, i) => s + i.amount, 0));
}

export function sumOwnInvestment(investments: InvestmentFinanceRecord[]): number {
  return round(
    activeInvestments(investments)
      .filter((i) => isOwnCapital(i.sourceType))
      .reduce((s, i) => s + i.amount, 0),
  );
}

export function sumThirdPartyInvestment(investments: InvestmentFinanceRecord[]): number {
  return round(
    activeInvestments(investments)
      .filter((i) => i.sourceType != null && !isOwnCapital(i.sourceType))
      .reduce((s, i) => s + i.amount, 0),
  );
}

export function buildInvestmentSources(
  investments: InvestmentFinanceRecord[],
): OperatorFinancialMetrics["investmentSources"] {
  const grouped = new Map<string, { sourceType: InvestmentSourceType; sourceName: string | null; amount: number }>();

  for (const inv of activeInvestments(investments)) {
    if (!inv.sourceType) continue;
    const key = `${inv.sourceType}::${inv.sourceName ?? ""}`;
    const current = grouped.get(key);
    if (current) {
      current.amount += inv.amount;
    } else {
      grouped.set(key, {
        sourceType: inv.sourceType,
        sourceName: inv.sourceName,
        amount: inv.amount,
      });
    }
  }

  return Array.from(grouped.values()).map((entry) => ({
    ...entry,
    amount: round(entry.amount),
    label: entry.sourceName
      ? `${INVESTMENT_SOURCE_LABELS[entry.sourceType]} (${entry.sourceName})`
      : INVESTMENT_SOURCE_LABELS[entry.sourceType],
  }));
}

/** Entrada no caixa do operador — recebimentos efetivos no período. */
export function computeOperatorCashIn(
  sales: OperatorSaleRecord[],
  cashFlow: OperatorCashFlowRecord[],
  period?: { start?: string; end?: string },
): number {
  const inPeriod = (date: string) => {
    if (period?.start && date < period.start) return false;
    if (period?.end && date > period.end) return false;
    return true;
  };

  let total = 0;

  for (const sale of sales) {
    const received = sale.amountReceived ?? sale.totalAmount;
    const paymentDate = sale.paymentDate ?? sale.date;

    // Liquidações de vendas anteriores entram via cash_flow (recebimento_venda_anterior).
    if (sale.paymentDate && sale.paymentDate !== sale.date) {
      continue;
    }

    if (sale.paymentStatus === "paid" && inPeriod(paymentDate)) {
      total += received;
    } else if (sale.paymentStatus === "partial" && sale.paymentDate && inPeriod(sale.paymentDate)) {
      total += received;
    }
  }

  for (const entry of cashFlow) {
    if (entry.type === "income" && inPeriod(entry.date)) {
      total += entry.amount;
    }
  }

  return round(total);
}

/** Saída do caixa do operador — desembolsos próprios + despesas. */
export function computeOperatorCashOut(
  investments: InvestmentFinanceRecord[],
  cashFlow: OperatorCashFlowRecord[],
  period?: { start?: string; end?: string },
): number {
  const inPeriod = (date: string) => {
    if (period?.start && date < period.start) return false;
    if (period?.end && date > period.end) return false;
    return true;
  };

  let total = sumOwnInvestment(investments.filter((i) => inPeriod(i.date)));

  for (const entry of cashFlow) {
    if (entry.type === "expense" && inPeriod(entry.date)) {
      total += entry.amount;
    }
  }

  return round(total);
}

export function computeOperationMetrics(
  sales: OperatorSaleRecord[],
  investments: InvestmentFinanceRecord[],
): OperationFinancialMetrics {
  const revenue = round(sales.reduce((s, v) => s + v.totalAmount, 0));
  const operationalProfit = round(sales.reduce((s, v) => s + v.profit, 0));
  const investment = sumOperationalInvestment(investments);
  const margin = revenue > 0 ? round((operationalProfit / revenue) * 100) : 0;
  const roi = investment > 0 ? round((operationalProfit / investment) * 100) : 0;

  return { revenue, investment, operationalProfit, margin, roi };
}

export function computeOperatorMetrics(
  sales: OperatorSaleRecord[],
  investments: InvestmentFinanceRecord[],
  cashFlow: OperatorCashFlowRecord[],
  period?: { start?: string; end?: string },
): OperatorFinancialMetrics {
  const ownInvestment = sumOwnInvestment(investments.filter((i) => {
    if (period?.start && i.date < period.start) return false;
    if (period?.end && i.date > period.end) return false;
    return true;
  }));
  const thirdPartyInvestment = sumThirdPartyInvestment(investments.filter((i) => {
    if (period?.start && i.date < period.start) return false;
    if (period?.end && i.date > period.end) return false;
    return true;
  }));
  const cashIn = computeOperatorCashIn(sales, cashFlow, period);
  const cashOut = computeOperatorCashOut(investments, cashFlow, period);

  return {
    ownInvestment,
    thirdPartyInvestment,
    investmentSources: buildInvestmentSources(
      investments.filter((i) => {
        if (period?.start && i.date < period.start) return false;
        if (period?.end && i.date > period.end) return false;
        return true;
      }),
    ),
    cashIn,
    cashOut,
    operatorNetGain: round(cashIn - cashOut),
  };
}

function formatCurrency(value: number): string {
  return `R$${value.toFixed(2).replace(".", ",")}`;
}

function describeSources(sources: OperatorFinancialMetrics["investmentSources"]): string {
  if (sources.length === 0) return "terceiros";
  return sources.map((s) => (s.sourceName ? s.sourceName : s.label)).join(", ");
}

export function buildProfitReconciliation(
  operation: OperationFinancialMetrics,
  operator: OperatorFinancialMetrics,
  sales: OperatorSaleRecord[],
): ProfitReconciliation {
  const gap = round(operator.operatorNetGain - operation.operationalProfit);
  const reasons: ProfitReconciliationReason[] = [];

  if (operator.thirdPartyInvestment > EPSILON) {
    reasons.push({
      code: "THIRD_PARTY_INVESTMENT",
      label: "Investimento de terceiros",
      amount: operator.thirdPartyInvestment,
    });
  }

  if (operator.ownInvestment > EPSILON) {
    reasons.push({
      code: "OWN_INVESTMENT",
      label: "Investimento próprio do operador",
      amount: operator.ownInvestment,
    });
  }

  const pendingRevenue = round(
    sales
      .filter((s) => s.paymentStatus === "pending" || s.paymentStatus === "partial")
      .reduce((s, v) => s + v.totalAmount - (v.amountReceived ?? 0), 0),
  );
  if (pendingRevenue > EPSILON) {
    reasons.push({
      code: "PENDING_SALES",
      label: "Vendas pendentes de recebimento",
      amount: pendingRevenue,
    });
  }

  const deferredIncome = round(
    sales.filter((s) => s.paymentDate && s.paymentDate !== s.date).length > 0
      ? operator.cashIn - sales
          .filter((s) => s.paymentStatus === "paid" && (!s.paymentDate || s.paymentDate === s.date))
          .reduce((s, v) => s + (v.amountReceived ?? v.totalAmount), 0)
      : 0,
  );
  if (deferredIncome > EPSILON) {
    reasons.push({
      code: "DEFERRED_COLLECTION",
      label: "Recebimentos de vendas anteriores",
      amount: deferredIncome,
    });
  }

  const expenseOut = round(operator.cashOut - operator.ownInvestment);
  if (expenseOut > EPSILON) {
    reasons.push({
      code: "OPERATOR_EXPENSE",
      label: "Despesas pagas pelo operador",
      amount: expenseOut,
    });
  }

  if (Math.abs(gap) < EPSILON) {
    return { gap: 0, hasGap: false, reasons, narrative: null };
  }

  const sourceDescription = describeSources(operator.investmentSources);
  let narrative: string;

  if (operator.thirdPartyInvestment > EPSILON && operator.ownInvestment < EPSILON) {
    narrative =
      `O investimento desta operação foi realizado por ${sourceDescription}. ` +
      `O lucro operacional do negócio foi de ${formatCurrency(operation.operationalProfit)}. ` +
      `Como o operador não realizou desembolso próprio, o ganho líquido do operador foi de ${formatCurrency(operator.operatorNetGain)}.`;
  } else if (operator.ownInvestment > EPSILON) {
    narrative =
      `O operador desembolsou ${formatCurrency(operator.ownInvestment)} em capital próprio. ` +
      `Lucro operacional: ${formatCurrency(operation.operationalProfit)}. ` +
      `Ganho líquido do operador: ${formatCurrency(operator.operatorNetGain)}.`;
  } else {
    narrative =
      `Lucro operacional: ${formatCurrency(operation.operationalProfit)}. ` +
      `Ganho líquido do operador: ${formatCurrency(operator.operatorNetGain)}. ` +
      `Diferença de ${formatCurrency(Math.abs(gap))} explicada por recebimentos, despesas ou investimentos de terceiros.`;
  }

  return { gap, hasGap: true, reasons, narrative };
}

export function computeDualFinancialView(
  sales: OperatorSaleRecord[],
  investments: InvestmentFinanceRecord[],
  cashFlow: OperatorCashFlowRecord[],
  period?: { start?: string; end?: string },
): DualFinancialView {
  const scopedSales = period
    ? sales.filter((s) => {
        if (period.start && s.date < period.start) return false;
        if (period.end && s.date > period.end) return false;
        return true;
      })
    : sales;

  const operation = computeOperationMetrics(scopedSales, investments);
  const operator = computeOperatorMetrics(sales, investments, cashFlow, period);
  const reconciliation = buildProfitReconciliation(operation, operator, scopedSales);

  return { operation, operator, reconciliation };
}
