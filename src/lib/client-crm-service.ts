import { ALL_BUSINESSES_ID, isAllBusinesses } from "@/lib/business-units";
import { getClientsForBusiness } from "@/lib/analytics";
import { clientBelongsToBusiness, buildClientSaleBusinessMap } from "@/lib/client-business-scope";
import { saleReceivedAmount, sumReceivedRevenue } from "@/lib/analytics-engine/client";
import type { MetricSale } from "@/lib/analytics-engine/types";
import {
  buildClientInsights,
  buildSuggestedAction,
  computeAverageTicket,
  computeBehaviorMetrics,
  computeClientBadge,
  computeRelationshipMetrics,
  formatRelativePurchaseDate,
  type ClientBadge,
  type ClientBehaviorMetrics,
  type ClientInsight,
  type ClientRelationshipMetrics,
  type ClientSaleSnapshot,
  type ClientStatsInput,
  type ClientSuggestedAction,
} from "@/lib/client-crm-view";
import { fetchMetricSaleItems, fetchMetricSales } from "@/platform/db/data-access/metrics";
import { getClientById } from "@/platform/db/repositories/client-repository";
import { listProducts } from "@/platform/db/repositories/product-repository";

export interface ClientCrmListItem {
  id: string;
  name: string;
  sector: string | null;
  company: string | null;
  phone: string | null;
  totalSpent: number;
  purchaseCount: number;
  lastPurchaseDate: string | null;
  lastPurchaseRelative: string;
  favoriteProduct: string;
  badge: ClientBadge | null;
}

export interface ClientCrmProfile {
  client: {
    id: string;
    name: string;
    sector: string | null;
    company: string | null;
    phone: string | null;
    notes: string | null;
  };
  summary: {
    totalSpent: number;
    totalReceived: number;
    pendingAmount: number;
    purchaseCount: number;
    averageTicket: number;
    lastPurchaseDate: string | null;
    lastPurchaseRelative: string;
    daysSinceLastPurchase: number | null;
    favoriteProduct: string;
    badge: ClientBadge | null;
  };
  behavior: ClientBehaviorMetrics;
  relationship: ClientRelationshipMetrics;
  timeline: ClientSaleSnapshot[];
  insights: ClientInsight[];
  suggestedAction: ClientSuggestedAction | null;
  isRecurring: boolean;
}

interface ClientAggregate {
  stats: ClientStatsInput;
  badge: ClientBadge | null;
}

function buildSaleSnapshots(
  clientSales: MetricSale[],
  itemsBySale: Map<string, Array<{ productName: string; quantity: number; subtotal: number }>>,
): ClientSaleSnapshot[] {
  return clientSales.map((sale) => ({
    id: sale.id!,
    date: sale.date,
    time: sale.time ?? "12:00",
    totalAmount: sale.totalAmount,
    amountReceived: sale.amountReceived ?? null,
    paymentStatus: sale.paymentStatus ?? "paid",
    paymentMethod: sale.paymentMethod ?? "pix",
    items: itemsBySale.get(sale.id!) ?? [],
  }));
}

function buildStatsFromSales(clientSales: MetricSale[], snapshots: ClientSaleSnapshot[]): ClientStatsInput {
  const productCounts: Record<string, number> = {};
  for (const sale of snapshots) {
    for (const item of sale.items) {
      productCounts[item.productName] = (productCounts[item.productName] ?? 0) + item.quantity;
    }
  }

  const favoriteProduct =
    Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Sem histórico";

  const totalSpent = clientSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalReceived = clientSales.reduce((sum, s) => sum + saleReceivedAmount(s), 0);
  const pendingAmount = Math.max(0, totalSpent - totalReceived);

  const sortedDates = [...clientSales].sort((a, b) => a.date.localeCompare(b.date));

  return {
    purchaseCount: clientSales.length,
    totalSpent,
    totalReceived,
    pendingAmount,
    firstPurchaseDate: sortedDates[0]?.date ?? null,
    lastPurchaseDate: sortedDates.at(-1)?.date ?? null,
    favoriteProduct,
    sales: snapshots,
  };
}

async function buildClientAggregates(businessId: string): Promise<{
  aggregates: Map<string, ClientAggregate>;
  totalBusinessRevenue: number;
  listContext: { avgSpent: number; topSpentThreshold: number };
}> {
  const scopedSales = await fetchMetricSales({ businessId });
  const saleIds = scopedSales.map((s) => s.id).filter(Boolean) as string[];
  const allItems = await fetchMetricSaleItems(saleIds);
  const allProducts = await listProducts(businessId);
  const productMap = new Map(allProducts.map((p) => [p.id, p.name]));

  const itemsBySale = new Map<string, Array<{ productName: string; quantity: number; subtotal: number }>>();
  for (const item of allItems) {
    const productName = productMap.get(item.productId) ?? "Produto";
    const list = itemsBySale.get(item.saleId!) ?? [];
    list.push({
      productName,
      quantity: item.quantity,
      subtotal: item.subtotal ?? 0,
    });
    itemsBySale.set(item.saleId!, list);
  }

  const salesByClient = new Map<string, MetricSale[]>();
  for (const sale of scopedSales) {
    if (!sale.clientId) continue;
    const list = salesByClient.get(sale.clientId) ?? [];
    list.push(sale);
    salesByClient.set(sale.clientId, list);
  }

  const totalBusinessRevenue = sumReceivedRevenue(scopedSales);
  const spentValues: number[] = [];
  const aggregates = new Map<string, ClientAggregate>();

  for (const [clientId, clientSales] of Array.from(salesByClient.entries())) {
    const snapshots = buildSaleSnapshots(clientSales, itemsBySale);
    const stats = buildStatsFromSales(clientSales, snapshots);
    spentValues.push(stats.totalReceived);
    aggregates.set(clientId, { stats, badge: null });
  }

  const avgSpent = spentValues.length > 0 ? spentValues.reduce((a, b) => a + b, 0) / spentValues.length : 0;
  const sortedSpent = [...spentValues].sort((a, b) => b - a);
  const topIndex = Math.max(0, Math.ceil(sortedSpent.length * 0.15) - 1);
  const topSpentThreshold = sortedSpent[topIndex] ?? 0;

  const listContext = { avgSpent, topSpentThreshold };

  for (const aggregate of Array.from(aggregates.values())) {
    aggregate.badge = computeClientBadge(aggregate.stats, listContext);
  }

  return { aggregates, totalBusinessRevenue, listContext };
}

export async function getClientCrmList(
  businessId: string = ALL_BUSINESSES_ID,
): Promise<ClientCrmListItem[]> {
  const clientRows = await getClientsForBusiness(businessId);
  const { aggregates } = await buildClientAggregates(businessId);
  const reference = new Date();

  return clientRows
    .map((client) => {
      const aggregate = aggregates.get(client.id);
      const stats = aggregate?.stats;
      const badge = aggregate?.badge ?? null;

      return {
        id: client.id,
        name: client.name,
        sector: client.sector,
        company: client.company,
        phone: client.phone,
        totalSpent: stats?.totalReceived ?? 0,
        purchaseCount: stats?.purchaseCount ?? 0,
        lastPurchaseDate: stats?.lastPurchaseDate ?? null,
        lastPurchaseRelative: stats?.lastPurchaseDate
          ? formatRelativePurchaseDate(stats.lastPurchaseDate, reference)
          : "Sem compras",
        favoriteProduct: stats?.favoriteProduct ?? "Sem histórico",
        badge,
      };
    })
    .sort((a, b) => {
      if (b.purchaseCount !== a.purchaseCount) return b.purchaseCount - a.purchaseCount;
      if (b.totalSpent !== a.totalSpent) return b.totalSpent - a.totalSpent;
      return a.name.localeCompare(b.name, "pt-BR");
    });
}

export async function getClientCrmProfile(
  clientId: string,
  businessId: string = ALL_BUSINESSES_ID,
): Promise<ClientCrmProfile | null> {
  const client = await getClientById(clientId);
  if (!client) return null;

  const saleBusinessMap = await buildClientSaleBusinessMap();
  if (!clientBelongsToBusiness(client, businessId, saleBusinessMap)) {
    return null;
  }

  let clientSales = (await fetchMetricSales()).filter((s) => s.clientId === clientId);
  if (!isAllBusinesses(businessId)) {
    clientSales = clientSales.filter((s) => s.businessId === businessId);
  }

  clientSales.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return (b.time ?? "").localeCompare(a.time ?? "");
  });

  const saleIds = clientSales.map((s) => s.id).filter(Boolean) as string[];
  const allItems = await fetchMetricSaleItems(saleIds);
  const allProducts = await listProducts(businessId);
  const productMap = new Map(allProducts.map((p) => [p.id, p.name]));

  const itemsBySale = new Map<string, Array<{ productName: string; quantity: number; subtotal: number }>>();
  for (const item of allItems) {
    const productName = productMap.get(item.productId) ?? "Produto";
    const list = itemsBySale.get(item.saleId!) ?? [];
    list.push({
      productName,
      quantity: item.quantity,
      subtotal: item.subtotal ?? 0,
    });
    itemsBySale.set(item.saleId!, list);
  }

  const snapshots = buildSaleSnapshots(clientSales, itemsBySale);
  const stats = buildStatsFromSales(clientSales, snapshots);

  const { totalBusinessRevenue, listContext } = await buildClientAggregates(businessId);
  const badge = computeClientBadge(stats, listContext);
  const behavior = computeBehaviorMetrics(stats);
  const relationship = computeRelationshipMetrics(stats, totalBusinessRevenue);
  const insights = buildClientInsights(stats, behavior, relationship);
  const suggestedAction = buildSuggestedAction(stats, behavior);

  const reference = new Date();
  const daysSinceLastPurchase = stats.lastPurchaseDate
    ? Math.max(0, Math.floor((reference.getTime() - new Date(stats.lastPurchaseDate).getTime()) / 86400000))
    : null;

  return {
    client: {
      id: client.id,
      name: client.name,
      sector: client.sector,
      company: client.company,
      phone: client.phone,
      notes: client.notes,
    },
    summary: {
      totalSpent: stats.totalSpent,
      totalReceived: stats.totalReceived,
      pendingAmount: stats.pendingAmount,
      purchaseCount: stats.purchaseCount,
      averageTicket: computeAverageTicket(stats.totalReceived, stats.purchaseCount),
      lastPurchaseDate: stats.lastPurchaseDate,
      lastPurchaseRelative: stats.lastPurchaseDate
        ? formatRelativePurchaseDate(stats.lastPurchaseDate, reference)
        : "Sem compras",
      daysSinceLastPurchase,
      favoriteProduct: stats.favoriteProduct,
      badge,
    },
    behavior,
    relationship,
    timeline: snapshots,
    insights,
    suggestedAction,
    isRecurring: stats.purchaseCount >= 3,
  };
}
