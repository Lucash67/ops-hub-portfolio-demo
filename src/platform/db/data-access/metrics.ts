import { and, eq, gte, lte, inArray, or, isNull, type SQL } from "drizzle-orm";
import { getPostgresDb, getSqliteDb, isPostgres } from "@/platform/db";
import { resolveBusinessScopeId } from "@/platform/db/mappers";
import { fromDbBusinessId } from "@/platform/db/business-id";
import { mapClientRow, mapGoalRow, mapProductRow, mapSaleRow } from "@/platform/db/mappers";
import { queryAll } from "@/platform/db/query";
import { getTenantContext, getTenantDbIds } from "@/lib/auth/tenant-context";
import {
  clients as sqliteClients,
  goals as sqliteGoals,
  products as sqliteProducts,
  saleItems as sqliteSaleItems,
  sales as sqliteSales,
} from "@/lib/db/schema";
import {
  clients as pgClients,
  goals as pgGoals,
  products as pgProducts,
  saleItems as pgSaleItems,
  sales as pgSales,
} from "@/lib/db/postgres/schema";
import { ALL_BUSINESSES_ID, isAllBusinesses } from "@/lib/business-units";
import type { MetricProduct, MetricSale, MetricSaleItem } from "@/lib/analytics-engine/types";

export interface ScopedSalesQuery {
  businessId?: string;
  dateEq?: string;
  dateGte?: string;
  dateLte?: string;
}

function isTenantEmpty(): boolean {
  const ids = getTenantDbIds();
  return ids !== undefined && ids.length === 0;
}

function appendBusinessScope(conditions: SQL[], businessId: string, pg: boolean): void {
  const tenantIds = getTenantDbIds();
  if (!isAllBusinesses(businessId)) {
    const scopedId = pg ? resolveBusinessScopeId(businessId) : businessId;
    conditions.push(pg ? eq(pgSales.businessId, scopedId) : eq(sqliteSales.businessId, scopedId));
    return;
  }
  if (tenantIds !== undefined) {
    conditions.push(
      pg ? inArray(pgSales.businessId, tenantIds) : inArray(sqliteSales.businessId, tenantIds),
    );
  }
}

function appendProductBusinessScope(conditions: SQL[], businessId: string, pg: boolean): void {
  const tenantIds = getTenantDbIds();
  if (!isAllBusinesses(businessId)) {
    const scopedId = pg ? resolveBusinessScopeId(businessId) : businessId;
    conditions.push(pg ? eq(pgProducts.businessId, scopedId) : eq(sqliteProducts.businessId, scopedId));
    return;
  }
  if (tenantIds !== undefined) {
    conditions.push(
      pg ? inArray(pgProducts.businessId, tenantIds) : inArray(sqliteProducts.businessId, tenantIds),
    );
  }
}

function goalBelongsToTenant(businessId: string, slugs: string[]): boolean {
  return slugs.includes(businessId);
}

function toMetricSale(row: ReturnType<typeof mapSaleRow>): MetricSale {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    clientId: row.clientId,
    paymentMethod: row.paymentMethod ?? undefined,
    paymentStatus: row.paymentStatus,
    amountReceived: row.amountReceived,
    totalAmount: row.totalAmount,
    profit: row.profit,
    totalCost: row.totalCost,
    department: row.department,
    businessId: row.businessId,
  };
}

function toMetricProduct(row: ReturnType<typeof mapProductRow>): MetricProduct {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    cost: row.cost,
    stockQuantity: row.stockQuantity,
    minStock: row.minStock,
    businessId: row.businessId,
    status: row.status,
  };
}

export async function fetchMetricSales(query: ScopedSalesQuery = {}): Promise<MetricSale[]> {
  if (isTenantEmpty()) return [];

  const businessId = query.businessId ?? ALL_BUSINESSES_ID;

  if (isPostgres()) {
    const db = await getPostgresDb();
    const conditions: SQL[] = [];
    appendBusinessScope(conditions, businessId, true);
    if (query.dateEq) conditions.push(eq(pgSales.saleDate, query.dateEq));
    if (query.dateGte) conditions.push(gte(pgSales.saleDate, query.dateGte));
    if (query.dateLte) conditions.push(lte(pgSales.saleDate, query.dateLte));

    const rows =
      conditions.length > 0
        ? await queryAll(db.select().from(pgSales).where(and(...conditions)))
        : await queryAll(db.select().from(pgSales));
    return rows.map((r) => toMetricSale(mapSaleRow(r)));
  }

  const db = getSqliteDb();
  const conditions: SQL[] = [];
  appendBusinessScope(conditions, businessId, false);
  if (query.dateEq) conditions.push(eq(sqliteSales.date, query.dateEq));
  if (query.dateGte) conditions.push(gte(sqliteSales.date, query.dateGte));
  if (query.dateLte) conditions.push(lte(sqliteSales.date, query.dateLte));

  const rows =
    conditions.length > 0
      ? await queryAll(db.select().from(sqliteSales).where(and(...conditions)))
      : await queryAll(db.select().from(sqliteSales));
  return rows.map((r) => toMetricSale(mapSaleRow(r)));
}

export async function fetchMetricProducts(
  businessId: string = ALL_BUSINESSES_ID,
  activeOnly = false,
): Promise<MetricProduct[]> {
  if (isTenantEmpty()) return [];

  if (isPostgres()) {
    const db = await getPostgresDb();
    const conditions: SQL[] = [];
    appendProductBusinessScope(conditions, businessId, true);
    let rows =
      conditions.length > 0
        ? await queryAll(db.select().from(pgProducts).where(and(...conditions)))
        : await queryAll(db.select().from(pgProducts));
    if (activeOnly) rows = rows.filter((r) => r.status === "active");
    return rows.map((r) => toMetricProduct(mapProductRow(r)));
  }

  const db = getSqliteDb();
  const conditions: SQL[] = [];
  appendProductBusinessScope(conditions, businessId, false);
  let rows =
    conditions.length > 0
      ? await queryAll(db.select().from(sqliteProducts).where(and(...conditions)))
      : await queryAll(db.select().from(sqliteProducts));
  if (activeOnly) rows = rows.filter((r) => r.status === "active");
  return rows.map((r) => toMetricProduct(mapProductRow(r)));
}

export async function fetchMetricSaleItems(saleIds: string[]): Promise<MetricSaleItem[]> {
  if (saleIds.length === 0) return [];

  if (isPostgres()) {
    const db = await getPostgresDb();
    const rows = await queryAll(
      db.select().from(pgSaleItems).where(inArray(pgSaleItems.saleId, saleIds)),
    );
    return rows.map((i) => ({
      saleId: i.saleId,
      productId: i.productId,
      quantity: i.quantity,
      subtotal: Number(i.subtotal),
      profit: Number(i.profit),
    }));
  }

  const db = getSqliteDb();
  const rows = await queryAll(
    db.select().from(sqliteSaleItems).where(inArray(sqliteSaleItems.saleId, saleIds)),
  );
  return rows.map((i) => ({
    saleId: i.saleId,
    productId: i.productId,
    quantity: i.quantity,
    subtotal: i.subtotal,
    profit: i.profit,
  }));
}

export async function fetchMetricClients() {
  if (isTenantEmpty()) return [];

  const tenant = getTenantContext();
  let clients: ReturnType<typeof mapClientRow>[];

  if (isPostgres()) {
    const db = await getPostgresDb();
    if (tenant && tenant.dbIds.length > 0) {
      clients = (
        await queryAll(
          db
            .select()
            .from(pgClients)
            .where(
              or(
                inArray(pgClients.registeredBusinessId, tenant.dbIds),
                isNull(pgClients.registeredBusinessId),
              ),
            ),
        )
      ).map(mapClientRow);
    } else {
      clients = (await queryAll(db.select().from(pgClients))).map(mapClientRow);
    }
  } else {
    const db = getSqliteDb();
    clients = (await queryAll(db.select().from(sqliteClients))).map(mapClientRow);
    if (tenant && tenant.slugs.length > 0) {
      clients = clients.filter(
        (c) => !c.businessId || tenant.slugs.includes(c.businessId),
      );
    }
  }

  if (!tenant) return clients;

  const scopedSales = await fetchMetricSales({});
  const linkedClientIds = new Set(
    scopedSales.map((s) => s.clientId).filter((id): id is string => Boolean(id)),
  );
  return clients.filter(
    (c) =>
      linkedClientIds.has(c.id) ||
      (c.businessId && tenant.slugs.includes(c.businessId)),
  );
}

export async function fetchMetricGoals(businessId: string = ALL_BUSINESSES_ID) {
  if (isTenantEmpty()) return [];

  const tenant = getTenantContext();
  let allGoals: ReturnType<typeof mapGoalRow>[];

  if (isPostgres()) {
    const db = await getPostgresDb();
    if (tenant && isAllBusinesses(businessId) && tenant.dbIds.length > 0) {
      allGoals = (
        await queryAll(
          db.select().from(pgGoals).where(inArray(pgGoals.businessId, tenant.dbIds)),
        )
      ).map(mapGoalRow);
    } else {
      allGoals = (await queryAll(db.select().from(pgGoals))).map(mapGoalRow);
    }
  } else {
    const db = getSqliteDb();
    allGoals = (await queryAll(db.select().from(sqliteGoals))).map(mapGoalRow);
    if (tenant && isAllBusinesses(businessId)) {
      allGoals = allGoals.filter((g) => goalBelongsToTenant(g.businessId, tenant.slugs));
    }
  }

  if (!isAllBusinesses(businessId)) {
    return allGoals.filter((g) => g.businessId === businessId);
  }

  const aggregated = new Map<string, (typeof allGoals)[number]>();
  for (const goal of allGoals) {
    const current = aggregated.get(goal.type);
    if (current) {
      aggregated.set(goal.type, {
        ...current,
        targetAmount: current.targetAmount + goal.targetAmount,
      });
    } else {
      aggregated.set(goal.type, { ...goal, id: `all-${goal.type}` });
    }
  }
  return Array.from(aggregated.values());
}

export { fromDbBusinessId };
