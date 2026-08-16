import { format, getDay, parseISO } from "date-fns";
import { computeGrowth, flavorQuantityBreakdown } from "@/lib/analytics-engine/client";
import { isUnidentifiedFlavorProduct } from "@/lib/salgados-flavors";
import { SALGADOS_BUSINESS_ID } from "@/lib/business-units";

export type PurchasePlanningMode = "auto" | "manual_total" | "manual_distribution";

export interface ProductDistribution {
  croissant: number;
  pastel: number;
  misto: number;
}

export interface PurchasePlanSuggestion {
  totalUnits: number;
  distribution: ProductDistribution;
  unitCostEstimate: number;
  investmentEstimate: number;
  rationale: string[];
  confidence: "high" | "medium" | "low";
  morningTargetUnits: number;
}

export interface DistributionValidation {
  totalUnits: number;
  distribution: ProductDistribution;
  isAdequate: boolean;
  feedback: string[];
  suggestedAdjustment?: ProductDistribution;
}

export interface PurchasePlanningInput {
  businessId: string;
  referenceDate?: string;
  sales: Array<{ date: string; time: string; id?: string }>;
  items: Array<{ saleId?: string; productId: string; quantity: number }>;
  productNameById: (id: string) => string;
  avgUnitCost: number;
  diaryInsights?: {
    manualInsights?: string;
    lessonsLearned?: string;
    dailyGoalUnits?: number;
    morningGoalUnits?: number;
  };
  recurringClientCount?: number;
  pendingPreOrders?: number;
}

const DEFAULT_DISTRIBUTION: ProductDistribution = { croissant: 4, pastel: 4, misto: 4 };

function isOperationalDay(date: string, businessId: string): boolean {
  if (businessId !== SALGADOS_BUSINESS_ID) return true;
  const day = getDay(parseISO(date));
  return day !== 0 && day !== 6;
}

function unitsByDate(input: PurchasePlanningInput): Map<string, number> {
  const itemsBySale = new Map<string, number>();
  for (const item of input.items) {
    if (!item.saleId) continue;
    itemsBySale.set(item.saleId, (itemsBySale.get(item.saleId) ?? 0) + item.quantity);
  }
  const map = new Map<string, number>();
  for (const sale of input.sales) {
    if (!isOperationalDay(sale.date, input.businessId)) continue;
    const units = sale.id ? (itemsBySale.get(sale.id) ?? 0) : 0;
    map.set(sale.date, (map.get(sale.date) ?? 0) + units);
  }
  return map;
}

function flavorBreakdownByDate(
  input: PurchasePlanningInput,
): Map<string, Record<string, number>> {
  const map = new Map<string, Record<string, number>>();
  const itemsBySale = new Map<string, typeof input.items>();
  for (const item of input.items) {
    if (!item.saleId) continue;
    const list = itemsBySale.get(item.saleId) ?? [];
    list.push(item);
    itemsBySale.set(item.saleId, list);
  }
  for (const sale of input.sales) {
    if (!isOperationalDay(sale.date, input.businessId) || !sale.id) continue;
    const dayItems = itemsBySale.get(sale.id) ?? [];
    const breakdown = flavorQuantityBreakdown(dayItems, input.productNameById);
    const existing = map.get(sale.date) ?? {};
    for (const [name, qty] of Object.entries(breakdown)) {
      if (isUnidentifiedFlavorProduct(name)) continue;
      const key = name.toLowerCase().includes("pastel")
        ? "pastel"
        : name.toLowerCase().includes("misto")
          ? "misto"
          : "croissant";
      existing[key] = (existing[key] ?? 0) + qty;
    }
    map.set(sale.date, existing);
  }
  return map;
}

function roundUnits(value: number): number {
  return Math.max(1, Math.round(value));
}

function distributeByShare(total: number, shares: ProductDistribution): ProductDistribution {
  const sum = shares.croissant + shares.pastel + shares.misto || 1;
  let croissant = roundUnits(total * (shares.croissant / sum));
  let pastel = roundUnits(total * (shares.pastel / sum));
  let misto = total - croissant - pastel;
  if (misto < 1) {
    misto = 1;
    const overflow = croissant + pastel + misto - total;
    if (croissant >= overflow) croissant -= overflow;
    else pastel -= overflow - croissant;
  }
  return { croissant, pastel, misto: Math.max(1, misto) };
}

export function suggestPurchasePlan(input: PurchasePlanningInput): PurchasePlanSuggestion {
  const ref = input.referenceDate ?? format(new Date(), "yyyy-MM-dd");
  const dayMap = unitsByDate(input);
  const flavorMap = flavorBreakdownByDate(input);
  const rationale: string[] = [];

  const historical = Array.from(dayMap.entries())
    .filter(([d]) => d < ref && isOperationalDay(d, input.businessId))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, units]) => ({ date, units }));

  if (historical.length === 0) {
    const fallback = input.diaryInsights?.dailyGoalUnits ?? 12;
    return {
      totalUnits: fallback,
      distribution: DEFAULT_DISTRIBUTION,
      unitCostEstimate: input.avgUnitCost,
      investmentEstimate: Math.round(fallback * input.avgUnitCost * 100) / 100,
      rationale: ["Histórico insuficiente — usando meta do Diário Operacional."],
      confidence: "low",
      morningTargetUnits: input.diaryInsights?.morningGoalUnits ?? 8,
    };
  }

  const recent = historical.slice(-5);
  const avgUnits = recent.reduce((s, r) => s + r.units, 0) / recent.length;
  rationale.push(
    `Média dos últimos ${recent.length} dia${recent.length > 1 ? "s" : ""}: ${roundUnits(avgUnits)} unidades.`,
  );

  let multiplier = 1.05;
  if (recent.length >= 2) {
    const growth = computeGrowth(recent[recent.length - 1].units, recent[0].units);
    if (growth > 10) {
      multiplier = 1.12;
      rationale.push("Tendência de crescimento — compra ligeiramente acima da média.");
    } else if (growth < -5) {
      multiplier = 1.0;
      rationale.push("Ritmo estável — compra alinhada à média.");
    }
  }

  const refDay = getDay(parseISO(ref));
  if (refDay === 2 || refDay === 4) {
    multiplier += 0.05;
    rationale.push("Terça/quinta: demanda histórica alta mesmo com menos funcionários (+5%).");
  }

  const insights = `${input.diaryInsights?.manualInsights ?? ""} ${input.diaryInsights?.lessonsLearned ?? ""}`.toLowerCase();
  if (insights.includes("demanda reprimida") || insights.includes("15h30")) {
    multiplier += 0.08;
    rationale.push("Demanda reprimida identificada — considerar +2 unidades.");
  }
  if (insights.includes("08h") || insights.includes("chegar mais cedo")) {
    multiplier += 0.1;
    rationale.push("Demanda matinal (08h–08h30) — antecipar compra se chegada for adiantada.");
  }

  if (input.pendingPreOrders && input.pendingPreOrders > 0) {
    multiplier += input.pendingPreOrders * 0.05;
    rationale.push(`${input.pendingPreOrders} encomenda(s) futura(s) considerada(s).`);
  }

  let totalUnits = roundUnits(avgUnits * multiplier);
  const ceiling = roundUnits(avgUnits * 1.3);
  totalUnits = Math.min(ceiling, Math.max(roundUnits(avgUnits), totalUnits));

  const flavorTotals: ProductDistribution = { croissant: 0, pastel: 0, misto: 0 };
  for (const [, flavors] of Array.from(flavorMap.entries())) {
    flavorTotals.croissant += flavors.croissant ?? 0;
    flavorTotals.pastel += flavors.pastel ?? 0;
    flavorTotals.misto += flavors.misto ?? 0;
  }
  const distribution = distributeByShare(totalUnits, flavorTotals);

  rationale.push(
    `Distribuição sugerida: ${distribution.pastel} Pastéis · ${distribution.croissant} Croissants · ${distribution.misto} Mistos.`,
  );

  const confidence: PurchasePlanSuggestion["confidence"] =
    historical.length >= 4 ? "high" : historical.length >= 2 ? "medium" : "low";

  return {
    totalUnits,
    distribution,
    unitCostEstimate: input.avgUnitCost,
    investmentEstimate: Math.round(totalUnits * input.avgUnitCost * 100) / 100,
    rationale,
    confidence,
    morningTargetUnits: input.diaryInsights?.morningGoalUnits ?? 8,
  };
}

export function planFromTotalUnits(
  input: PurchasePlanningInput,
  totalUnits: number,
): PurchasePlanSuggestion {
  const auto = suggestPurchasePlan(input);
  const distribution = distributeByShare(totalUnits, auto.distribution);
  return {
    ...auto,
    totalUnits,
    distribution,
    investmentEstimate: Math.round(totalUnits * input.avgUnitCost * 100) / 100,
    rationale: [
      ...auto.rationale.slice(0, 2),
      `Modo manual: ${totalUnits} unidades informadas pelo operador.`,
      `Distribuição recalculada: ${distribution.pastel} Pastéis · ${distribution.croissant} Croissants · ${distribution.misto} Mistos.`,
    ],
  };
}

export function validateDistribution(
  input: PurchasePlanningInput,
  distribution: ProductDistribution,
): DistributionValidation {
  const auto = suggestPurchasePlan(input);
  const totalUnits = distribution.croissant + distribution.pastel + distribution.misto;
  const feedback: string[] = [];
  let isAdequate = true;

  const diff = totalUnits - auto.totalUnits;
  if (Math.abs(diff) > 3) {
    isAdequate = false;
    feedback.push(
      diff > 0
        ? `Total ${totalUnits} un. está ${diff} acima da sugestão (${auto.totalUnits}). Risco de sobra.`
        : `Total ${totalUnits} un. está ${Math.abs(diff)} abaixo da sugestão (${auto.totalUnits}). Risco de ruptura.`,
    );
  } else if (diff !== 0) {
    feedback.push(`Total próximo da sugestão automática (${auto.totalUnits} un.).`);
  } else {
    feedback.push("Total alinhado com a sugestão automática.");
  }

  const autoDist = auto.distribution;
  for (const [key, label] of [
    ["pastel", "Pastel"],
    ["croissant", "Croissant"],
    ["misto", "Misto"],
  ] as const) {
    const userQty = distribution[key];
    const autoQty = autoDist[key];
    const gap = userQty - autoQty;
    if (Math.abs(gap) >= 2) {
      feedback.push(`${label}: ${userQty} informado vs ${autoQty} sugerido (${gap > 0 ? "+" : ""}${gap}).`);
    }
  }

  if (isAdequate) {
    feedback.push("Distribuição adequada para o histórico recente.");
  }

  return {
    totalUnits,
    distribution,
    isAdequate,
    feedback,
    suggestedAdjustment: isAdequate ? undefined : auto.distribution,
  };
}

export function planFromDistribution(
  input: PurchasePlanningInput,
  distribution: ProductDistribution,
): PurchasePlanSuggestion & { validation: DistributionValidation } {
  const validation = validateDistribution(input, distribution);
  const totalUnits = distribution.croissant + distribution.pastel + distribution.misto;
  const auto = suggestPurchasePlan(input);
  return {
    ...auto,
    totalUnits,
    distribution,
    investmentEstimate: Math.round(totalUnits * input.avgUnitCost * 100) / 100,
    rationale: [
      "Modo manual: distribuição informada pelo operador.",
      ...validation.feedback,
    ],
    validation,
  };
}
