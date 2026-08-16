import { SALGADO_UNIT_PRICE } from "./pricing";

export function roundOperationalMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Custo operacional do dia = receita − lucro declarado no diário. */
export function deriveOperationalCostBasis(revenue: number, profit: number): number {
  return roundOperationalMoney(revenue - profit);
}

/** Custo por unidade para calcular lucro de venda (reflete ajuda do Henrique quando houver). */
export function deriveUnitCostOperational(
  revenue: number,
  profit: number,
  totalUnits: number,
): number {
  if (totalUnits <= 0) return roundOperationalMoney(SALGADO_UNIT_PRICE * 0.7);
  const basis = deriveOperationalCostBasis(revenue, profit);
  if (basis <= 0) return 0;
  return roundOperationalMoney(basis / totalUnits);
}

export interface OperationalInvestmentSplit {
  totalInvestment: number;
  operationalCostBasis: number;
  ownInvestment: number;
  thirdPartyInvestment: number;
  thirdPartyName: string;
}

/** Infere split de capital (caixa) vs. custo operacional (economia do dia). */
export function deriveInvestmentSplit(input: {
  totalInvestment: number;
  revenue: number;
  profit: number;
  ownInvestmentHint?: number;
  thirdPartyAmountHint?: number;
  thirdPartyName?: string;
}): OperationalInvestmentSplit {
  const operationalCostBasis = deriveOperationalCostBasis(input.revenue, input.profit);
  const thirdPartyName = input.thirdPartyName ?? "Henrique";

  let ownInvestment = input.ownInvestmentHint;
  let thirdPartyInvestment = input.thirdPartyAmountHint ?? 0;

  const hasExplicitSplit =
    (ownInvestment !== undefined && ownInvestment > 0) || thirdPartyInvestment > 0;

  if (hasExplicitSplit) {
    ownInvestment = ownInvestment ?? Math.max(0, input.totalInvestment - thirdPartyInvestment);
    thirdPartyInvestment =
      thirdPartyInvestment > 0
        ? thirdPartyInvestment
        : Math.max(0, input.totalInvestment - (ownInvestment ?? 0));
  } else if (
    input.totalInvestment > 0 &&
    operationalCostBasis < input.totalInvestment - 0.01
  ) {
    ownInvestment = operationalCostBasis;
    thirdPartyInvestment = roundOperationalMoney(input.totalInvestment - operationalCostBasis);
  } else if (input.totalInvestment > 0) {
    ownInvestment = 0;
    thirdPartyInvestment = input.totalInvestment;
  } else {
    ownInvestment = ownInvestment ?? operationalCostBasis;
    thirdPartyInvestment = 0;
  }

  return {
    totalInvestment: input.totalInvestment,
    operationalCostBasis,
    ownInvestment: ownInvestment ?? 0,
    thirdPartyInvestment,
    thirdPartyName,
  };
}

export function buildHenriqueProfitExplanation(input: {
  profit: number;
  revenue: number;
  totalInvestment: number;
  totalUnits: number;
  thirdPartyName: string;
  thirdPartyInvestment: number;
  operationalCostBasis: number;
  unitPrice?: number;
}): string | null {
  const unitPrice = input.unitPrice ?? SALGADO_UNIT_PRICE;
  const unitCost = deriveUnitCostOperational(input.revenue, input.profit, input.totalUnits);
  const fullUnitCost =
    input.totalUnits > 0 && input.totalInvestment > 0
      ? roundOperationalMoney(input.totalInvestment / input.totalUnits)
      : unitCost;

  if (input.operationalCostBasis <= 0.01 && input.profit >= input.revenue - 0.01) {
    return (
      `Lucro operacional de R$${input.profit.toFixed(2)} (= faturamento): ${input.thirdPartyName} arcou com 100% do investimento ` +
      `(R$${input.totalInvestment.toFixed(2)}). Você não teve custo próprio com os salgados neste dia.`
    );
  }

  if (input.thirdPartyInvestment <= 0.01 && Math.abs(unitCost - fullUnitCost) < 0.01) {
    return null;
  }

  if (input.thirdPartyInvestment > 0.01) {
    return (
      `Lucro operacional de R$${input.profit.toFixed(2)}: ${input.thirdPartyName} participou com R$${input.thirdPartyInvestment.toFixed(2)} do investimento (total R$${input.totalInvestment.toFixed(2)}). ` +
      `Custo operacional real: R$${input.operationalCostBasis.toFixed(2)} (${input.totalUnits} un. × R$${unitCost.toFixed(2)}). Vendas a R$${unitPrice.toFixed(2)}/un.`
    );
  }

  return (
    `Lucro operacional de R$${input.profit.toFixed(2)} com custo de R$${input.operationalCostBasis.toFixed(2)} ` +
    `(R$${unitCost.toFixed(2)}/un vs. R$${fullUnitCost.toFixed(2)}/un de custo total da compra).`
  );
}
