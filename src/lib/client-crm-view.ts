import {
  differenceInDays,
  differenceInCalendarMonths,
  parseISO,
  subDays,
} from "date-fns";
import { averageTicket, saleReceivedAmount } from "@/lib/analytics-engine/client";
import { formatSaleShift } from "@/lib/sale-shift";
import { paymentMethodLabel } from "@/lib/utils";

export type ClientBadgeType = "vip" | "recorrente" | "novo" | "frequente" | "inativo";

export type ClientFilterId =
  | "all"
  | "vip"
  | "recorrentes"
  | "novos"
  | "inativos"
  | "maior_faturamento"
  | "maior_frequencia";

export type PurchaseTrend = "growing" | "stable" | "declining" | "unknown";

export interface ClientSaleSnapshot {
  id: string;
  date: string;
  time: string;
  totalAmount: number;
  amountReceived?: number | null;
  paymentStatus?: string | null;
  paymentMethod: string;
  items: Array<{
    productName: string;
    quantity: number;
    subtotal: number;
  }>;
}

export interface ClientStatsInput {
  purchaseCount: number;
  totalSpent: number;
  totalReceived: number;
  pendingAmount: number;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
  favoriteProduct: string;
  sales: ClientSaleSnapshot[];
}

export interface ClientBadge {
  type: ClientBadgeType;
  label: string;
  emoji: string;
}

export interface ClientBehaviorMetrics {
  preferredHour: string | null;
  preferredWeekday: string | null;
  averageQuantityPerPurchase: number;
  preferredPaymentMethod: string;
  preferredPaymentLabel: string;
  trend: PurchaseTrend;
  trendLabel: string;
}

export interface ClientRelationshipMetrics {
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
  daysAsCustomer: number;
  purchaseFrequencyLabel: string;
  revenueSharePercent: number;
}

export interface ClientInsight {
  id: string;
  text: string;
}

export interface ClientSuggestedAction {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const BADGE_META: Record<ClientBadgeType, Omit<ClientBadge, "type">> = {
  vip: { label: "VIP", emoji: "⭐" },
  recorrente: { label: "Cliente Recorrente", emoji: "🟢" },
  novo: { label: "Cliente Novo", emoji: "🟡" },
  frequente: { label: "Cliente Frequente", emoji: "🔵" },
  inativo: { label: "Inativo", emoji: "🟠" },
};

const TREND_LABELS: Record<PurchaseTrend, string> = {
  growing: "Comprando mais",
  stable: "Estável",
  declining: "Comprando menos",
  unknown: "Sem histórico suficiente",
};

export function formatRelativePurchaseDate(date: string, reference = new Date()): string {
  const target = parseISO(date);
  const days = differenceInDays(reference, target);

  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 7) return `Há ${days} dias`;
  if (days < 14) return "Há 1 semana";
  if (days < 21) return "Há 2 semanas";
  if (days < 30) return "Há 3 semanas";
  if (days < 60) return "Há 1 mês";
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `Há ${months} meses`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? "Há 1 ano" : `Há ${years} anos`;
}

function daysSince(date: string | null, reference = new Date()): number | null {
  if (!date) return null;
  return differenceInDays(reference, parseISO(date));
}

function purchasesInWindow(sales: ClientSaleSnapshot[], from: string, to: string): ClientSaleSnapshot[] {
  return sales.filter((s) => s.date >= from && s.date <= to);
}

function sumWindowRevenue(sales: ClientSaleSnapshot[]): number {
  return sales.reduce((sum, s) => sum + saleReceivedAmount(s), 0);
}

export function computePurchaseTrend(sales: ClientSaleSnapshot[], reference = new Date()): PurchaseTrend {
  if (sales.length < 2) return "unknown";

  const today = reference.toISOString().slice(0, 10);
  const last30Start = subDays(reference, 30).toISOString().slice(0, 10);
  const prev30Start = subDays(reference, 60).toISOString().slice(0, 10);
  const prev30End = subDays(reference, 31).toISOString().slice(0, 10);

  const recent = sumWindowRevenue(purchasesInWindow(sales, last30Start, today));
  const previous = sumWindowRevenue(purchasesInWindow(sales, prev30Start, prev30End));

  if (previous === 0 && recent > 0) return "growing";
  if (previous === 0 && recent === 0) return "unknown";

  const change = ((recent - previous) / previous) * 100;
  if (change >= 20) return "growing";
  if (change <= -20) return "declining";
  return "stable";
}

export function computeClientBadge(
  stats: ClientStatsInput,
  context: { avgSpent: number; topSpentThreshold: number },
  reference = new Date(),
): ClientBadge | null {
  if (stats.purchaseCount === 0) return null;

  const inactiveDays = daysSince(stats.lastPurchaseDate, reference) ?? 0;

  if (inactiveDays >= 14) {
    return { type: "inativo", ...BADGE_META.inativo };
  }

  if (stats.totalSpent >= context.topSpentThreshold || stats.totalSpent >= context.avgSpent * 2) {
    return { type: "vip", ...BADGE_META.vip };
  }

  const daysSinceFirst = daysSince(stats.firstPurchaseDate, reference) ?? 0;
  if (stats.purchaseCount === 1 && daysSinceFirst <= 21) {
    return { type: "novo", ...BADGE_META.novo };
  }

  if (stats.purchaseCount >= 3) {
    return { type: "recorrente", ...BADGE_META.recorrente };
  }

  const last30Start = subDays(reference, 30).toISOString().slice(0, 10);
  const today = reference.toISOString().slice(0, 10);
  const recentCount = purchasesInWindow(stats.sales, last30Start, today).length;
  if (stats.purchaseCount >= 2 && recentCount >= 2) {
    return { type: "frequente", ...BADGE_META.frequente };
  }

  return null;
}

function modeValue(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function computeBehaviorMetrics(stats: ClientStatsInput, reference = new Date()): ClientBehaviorMetrics {
  const hours = stats.sales.map((s) => parseInt(s.time.split(":")[0] ?? "0", 10));
  const hourCounts = new Map<number, number>();
  for (const hour of hours) {
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  const topHour = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

  const weekdays = stats.sales.map((s) => WEEKDAY_LABELS[parseISO(s.date).getDay()]);
  const preferredWeekday = modeValue(weekdays);

  const totalUnits = stats.sales.reduce(
    (sum, sale) => sum + sale.items.reduce((s, i) => s + i.quantity, 0),
    0,
  );

  const paymentMethods = stats.sales.map((s) => s.paymentMethod);
  const preferredPayment = modeValue(paymentMethods) ?? "pix";

  const trend = computePurchaseTrend(stats.sales, reference);

  return {
    preferredHour:
      topHour != null
        ? formatSaleShift(`${String(topHour).padStart(2, "0")}:00`)
        : null,
    preferredWeekday: preferredWeekday,
    averageQuantityPerPurchase:
      stats.purchaseCount > 0 ? Math.round((totalUnits / stats.purchaseCount) * 10) / 10 : 0,
    preferredPaymentMethod: preferredPayment,
    preferredPaymentLabel: paymentMethodLabel(preferredPayment),
    trend,
    trendLabel: TREND_LABELS[trend],
  };
}

export function computeRelationshipMetrics(
  stats: ClientStatsInput,
  totalBusinessRevenue: number,
  reference = new Date(),
): ClientRelationshipMetrics {
  const first = stats.firstPurchaseDate;
  const last = stats.lastPurchaseDate;
  const daysAsCustomer = first ? differenceInDays(reference, parseISO(first)) : 0;

  let purchaseFrequencyLabel = "Sem compras";
  if (stats.purchaseCount === 1) {
    purchaseFrequencyLabel = "Compra única";
  } else if (first && last) {
    const spanMonths = Math.max(1, differenceInCalendarMonths(parseISO(last), parseISO(first)) + 1);
    const perMonth = stats.purchaseCount / spanMonths;
    purchaseFrequencyLabel =
      perMonth >= 1
        ? `${perMonth.toFixed(1).replace(".", ",")} compras/mês`
        : `1 compra a cada ${Math.round(spanMonths / stats.purchaseCount)} meses`;
  }

  const revenueSharePercent =
    totalBusinessRevenue > 0 ? Math.round((stats.totalReceived / totalBusinessRevenue) * 1000) / 10 : 0;

  return {
    firstPurchaseDate: first,
    lastPurchaseDate: last,
    daysAsCustomer,
    purchaseFrequencyLabel,
    revenueSharePercent,
  };
}

export function buildClientInsights(
  stats: ClientStatsInput,
  behavior: ClientBehaviorMetrics,
  relationship: ClientRelationshipMetrics,
  reference = new Date(),
): ClientInsight[] {
  const insights: ClientInsight[] = [];

  if (stats.favoriteProduct && stats.favoriteProduct !== "Sem histórico") {
    insights.push({
      id: "favorite-product",
      text: `Compra principalmente ${stats.favoriteProduct.split(" ")[0]}.`,
    });
  }

  if (behavior.preferredHour) {
    insights.push({
      id: "preferred-time",
      text: `Costuma comprar de ${behavior.preferredHour.toLowerCase()}.`,
    });
  }

  if (stats.purchaseCount > 0) {
    insights.push({
      id: "purchase-count",
      text: `Já comprou ${stats.purchaseCount} ${stats.purchaseCount === 1 ? "vez" : "vezes"}.`,
    });
  }

  const daysSinceLast = daysSince(stats.lastPurchaseDate, reference);
  if (daysSinceLast != null && daysSinceLast >= 7) {
    insights.push({
      id: "inactive-days",
      text: `Está há ${daysSinceLast} dias sem comprar.`,
    });
  }

  if (relationship.revenueSharePercent >= 1) {
    insights.push({
      id: "revenue-share",
      text: `Representa ${relationship.revenueSharePercent.toFixed(1).replace(".", ",")}% da receita.`,
    });
  }

  if (stats.purchaseCount >= 3) {
    insights.push({
      id: "recurring",
      text: "Possível cliente recorrente.",
    });
  }

  if (behavior.preferredWeekday && stats.purchaseCount >= 2) {
    const weekdayText =
      behavior.preferredWeekday === "Domingo"
        ? "aos domingos"
        : behavior.preferredWeekday === "Sábado"
          ? "aos sábados"
          : `às ${behavior.preferredWeekday}s-feiras`;
    insights.push({
      id: "weekday",
      text: `Compra com mais frequência ${weekdayText}.`,
    });
  }

  return insights;
}

export function buildSuggestedAction(
  stats: ClientStatsInput,
  behavior: ClientBehaviorMetrics,
  reference = new Date(),
): ClientSuggestedAction | null {
  if (stats.pendingAmount > 0) {
    return {
      id: "collect-payment",
      title: "Cobrar pagamento pendente",
      description: `${stats.pendingAmount.toFixed(2).replace(".", ",")} reais em aberto — priorize contato amigável.`,
      priority: "high",
    };
  }

  const daysSinceLast = daysSince(stats.lastPurchaseDate, reference) ?? 0;
  if (daysSinceLast >= 14) {
    return {
      id: "reactivate",
      title: "Cliente sem compras recentes",
      description: "Envie uma mensagem ou oferta para reativar o relacionamento.",
      priority: "high",
    };
  }

  if (stats.purchaseCount >= 3 && behavior.trend !== "declining") {
    return {
      id: "loyalty",
      title: "Excelente candidato para fidelização",
      description: "Considere benefício exclusivo ou aviso antecipado de novidades.",
      priority: "medium",
    };
  }

  if (stats.favoriteProduct && stats.favoriteProduct !== "Sem histórico") {
    const shortName = stats.favoriteProduct.split(" ")[0];
    return {
      id: "offer-favorite",
      title: `Oferecer ${shortName}`,
      description: `Produto favorito — garanta disponibilidade ou combo personalizado.`,
      priority: "medium",
    };
  }

  if (stats.purchaseCount === 1) {
    return {
      id: "welcome-back",
      title: "Acompanhar segunda compra",
      description: "Cliente novo — uma mensagem pós-compra pode acelerar a recorrência.",
      priority: "low",
    };
  }

  return {
    id: "monitor",
    title: "Manter relacionamento",
    description: "Continue registrando preferências a cada nova compra.",
    priority: "low",
  };
}

export function matchesClientFilter(
  badge: ClientBadge | null,
  stats: Pick<ClientStatsInput, "purchaseCount" | "totalSpent">,
  filter: ClientFilterId,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "vip":
      return badge?.type === "vip";
    case "recorrentes":
      return badge?.type === "recorrente" || stats.purchaseCount >= 3;
    case "novos":
      return badge?.type === "novo";
    case "inativos":
      return badge?.type === "inativo";
    case "maior_faturamento":
    case "maior_frequencia":
      return true;
    default:
      return true;
  }
}

export function sortClientsForFilter<T extends { totalSpent: number; purchaseCount: number }>(
  items: T[],
  filter: ClientFilterId,
): T[] {
  const sorted = [...items];
  if (filter === "maior_faturamento") {
    return sorted.sort((a, b) => b.totalSpent - a.totalSpent || b.purchaseCount - a.purchaseCount);
  }
  if (filter === "maior_frequencia") {
    return sorted.sort((a, b) => b.purchaseCount - a.purchaseCount || b.totalSpent - a.totalSpent);
  }
  return sorted.sort((a, b) => b.totalSpent - a.totalSpent);
}

export function computeAverageTicket(totalSpent: number, purchaseCount: number): number {
  return averageTicket(totalSpent, purchaseCount);
}
