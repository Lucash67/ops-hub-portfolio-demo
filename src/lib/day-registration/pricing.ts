import type { DayRegistrationPlan } from "./types";
import {
  buildHenriqueProfitExplanation,
  deriveInvestmentSplit,
  deriveUnitCostOperational,
  roundOperationalMoney,
} from "./operational-profit";

/** Preço de venda padrão dos salgados (ACAL / operação Lucas). */
export const SALGADO_UNIT_PRICE = 5;

export interface DayRegistrationPricing {
  unitPrice: number;
  /** Custo total por unidade (investimento ÷ unidades compradas). */
  unitCostFull: number;
  /** Custo operacional por unidade (receita − lucro) ÷ unidades — usado nas vendas. */
  unitCostOwn: number;
  ownInvestment: number;
  thirdPartyInvestment: number;
  thirdPartyName: string;
  totalUnits: number;
  operationalCostBasis: number;
  profitExplanation: string | null;
}

/**
 * Preço fixo R$ 5/un. Lucro operacional vem do diário/rascunho;
 * custo por unidade = (receita − lucro) ÷ unidades compradas.
 */
export function resolveDayRegistrationPricing(plan: DayRegistrationPlan): DayRegistrationPricing {
  const totalUnits =
    plan.purchase?.totalUnits ??
    plan.purchase?.products.reduce((sum, p) => sum + p.quantity, 0) ??
    plan.summary.quantitySold;

  const investment = plan.purchase?.investment ?? 0;
  const split = deriveInvestmentSplit({
    totalInvestment: investment,
    revenue: plan.summary.revenue,
    profit: plan.summary.profit,
    ownInvestmentHint: plan.purchase?.ownInvestment,
    thirdPartyAmountHint: plan.purchase?.thirdParty?.amount,
    thirdPartyName: plan.purchase?.thirdParty?.name,
  });

  const unitPrice = SALGADO_UNIT_PRICE;
  const unitCostFull =
    totalUnits > 0 && investment > 0
      ? roundOperationalMoney(investment / totalUnits)
      : roundOperationalMoney(unitPrice * 0.7);
  const unitCostOwn = deriveUnitCostOperational(
    plan.summary.revenue,
    plan.summary.profit,
    totalUnits,
  );

  const profitExplanation = buildHenriqueProfitExplanation({
    profit: plan.summary.profit,
    revenue: plan.summary.revenue,
    totalInvestment: investment,
    totalUnits,
    thirdPartyName: split.thirdPartyName,
    thirdPartyInvestment: split.thirdPartyInvestment,
    operationalCostBasis: split.operationalCostBasis,
    unitPrice,
  });

  return {
    unitPrice,
    unitCostFull,
    unitCostOwn,
    ownInvestment: split.ownInvestment,
    thirdPartyInvestment: split.thirdPartyInvestment,
    thirdPartyName: split.thirdPartyName,
    totalUnits,
    operationalCostBasis: split.operationalCostBasis,
    profitExplanation,
  };
}

export function buildPricingPreviewWarnings(pricing: DayRegistrationPricing): string[] {
  const warnings: string[] = [
    `Preço de venda: R$${pricing.unitPrice.toFixed(2)}/un (padrão). Custo operacional: R$${pricing.unitCostOwn.toFixed(2)}/un · custo total da compra: R$${pricing.unitCostFull.toFixed(2)}/un.`,
  ];
  if (pricing.profitExplanation) {
    warnings.push(pricing.profitExplanation);
  }
  return warnings;
}
