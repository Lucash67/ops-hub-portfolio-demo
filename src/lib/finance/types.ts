/** Tipos da camada financeira — operação vs operador. */

export const INVESTMENT_SOURCE_TYPES = [
  "own_capital",
  "family",
  "partner",
  "investor",
  "supplier",
  "loan",
  "other",
] as const;

export type InvestmentSourceType = (typeof INVESTMENT_SOURCE_TYPES)[number];

export const INVESTMENT_SOURCE_LABELS: Record<InvestmentSourceType, string> = {
  own_capital: "Capital Próprio",
  family: "Familiar",
  partner: "Sócio",
  investor: "Investidor",
  supplier: "Fornecedor",
  loan: "Empréstimo",
  other: "Outro",
};

export interface InvestmentFinanceRecord {
  id: string;
  amount: number;
  type: "initial" | "additional" | "withdrawal";
  date: string;
  description: string;
  sourceType: InvestmentSourceType | null;
  sourceName: string | null;
  businessId: string;
}

export interface OperatorSaleRecord {
  date: string;
  totalAmount: number;
  profit: number;
  totalCost: number;
  paymentStatus: string;
  amountReceived: number | null;
  paymentDate: string | null;
}

export interface OperatorCashFlowRecord {
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;
}

/** Métricas do negócio — camada operacional (inalterada). */
export interface OperationFinancialMetrics {
  revenue: number;
  investment: number;
  operationalProfit: number;
  margin: number;
  roi: number;
}

/** Métricas pessoais do operador — camada adicional. */
export interface OperatorFinancialMetrics {
  ownInvestment: number;
  thirdPartyInvestment: number;
  investmentSources: Array<{
    sourceType: InvestmentSourceType;
    sourceName: string | null;
    amount: number;
    label: string;
  }>;
  cashIn: number;
  cashOut: number;
  operatorNetGain: number;
}

export type ReconciliationReasonCode =
  | "THIRD_PARTY_INVESTMENT"
  | "DEFERRED_COLLECTION"
  | "PENDING_SALES"
  | "OPERATOR_EXPENSE"
  | "OWN_INVESTMENT";

export interface ProfitReconciliationReason {
  code: ReconciliationReasonCode;
  label: string;
  amount: number;
}

export interface ProfitReconciliation {
  gap: number;
  hasGap: boolean;
  reasons: ProfitReconciliationReason[];
  narrative: string | null;
}

export interface DualFinancialView {
  operation: OperationFinancialMetrics;
  operator: OperatorFinancialMetrics;
  reconciliation: ProfitReconciliation;
}
