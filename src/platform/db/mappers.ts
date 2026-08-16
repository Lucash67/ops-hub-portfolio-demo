import { fromDbBusinessId, toDbBusinessId } from "@/platform/db/business-id";
import { isPostgres } from "@/platform/db/config";
import { toDateString, toIsoTimestamp, toNumber } from "@/platform/db/query";
import type {
  LegacyClient,
  LegacyGoal,
  LegacyProduct,
  LegacySale,
} from "@/lib/db/types";
import type { products as sqliteProducts, clients as sqliteClients, sales as sqliteSales, goals as sqliteGoals } from "@/lib/db/schema";
import type {
  products as pgProducts,
  clients as pgClients,
  sales as pgSales,
  goals as pgGoals,
} from "@/lib/db/postgres/schema";

type SqliteProduct = typeof sqliteProducts.$inferSelect;
type PgProduct = typeof pgProducts.$inferSelect;

export function mapProductRow(row: SqliteProduct | PgProduct): LegacyProduct {
  if (isPostgres()) {
    const p = row as PgProduct;
    return {
      id: p.id,
      businessId: fromDbBusinessId(p.businessId),
      name: p.name,
      category: p.category,
      price: toNumber(p.unitPrice),
      cost: toNumber(p.unitCost),
      supplierId: null,
      stockQuantity: p.stockQuantity,
      soldQuantity: 0,
      minStock: p.minStock,
      imageUrl: p.imageUrl,
      status: p.status as "active" | "inactive",
      createdAt: toIsoTimestamp(p.createdAt),
      updatedAt: toIsoTimestamp(p.updatedAt),
    };
  }
  const p = row as SqliteProduct;
  return {
    id: p.id,
    businessId: p.businessId,
    name: p.name,
    category: p.category,
    price: p.price,
    cost: p.cost,
    supplierId: p.supplierId,
    stockQuantity: p.stockQuantity,
    soldQuantity: p.soldQuantity,
    minStock: p.minStock,
    imageUrl: p.imageUrl,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

type SqliteClient = typeof sqliteClients.$inferSelect;
type PgClient = typeof pgClients.$inferSelect;

export function mapClientRow(row: SqliteClient | PgClient): LegacyClient {
  if (isPostgres()) {
    const c = row as PgClient;
    return {
      id: c.id,
      businessId: c.registeredBusinessId ? fromDbBusinessId(c.registeredBusinessId) : undefined,
      name: c.name,
      sector: c.sector,
      company: c.company,
      phone: c.phone,
      notes: c.notes,
      createdAt: toIsoTimestamp(c.createdAt),
      updatedAt: toIsoTimestamp(c.updatedAt),
    };
  }
  const c = row as SqliteClient;
  return {
    id: c.id,
    businessId: c.businessId,
    name: c.name,
    sector: c.sector,
    company: c.company,
    phone: c.phone,
    notes: c.notes,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

type SqliteSale = typeof sqliteSales.$inferSelect;
type PgSale = typeof pgSales.$inferSelect;

export function mapSaleRow(row: SqliteSale | PgSale): LegacySale {
  if (isPostgres()) {
    const s = row as PgSale;
    return {
      id: s.id,
      businessId: fromDbBusinessId(s.businessId),
      date: toDateString(s.saleDate),
      time: String(s.saleTime).slice(0, 5),
      clientId: s.clientId,
      department: s.department,
      paymentMethod: s.paymentMethod,
      paymentStatus: s.paymentStatus,
      amountReceived: toNumber(s.amountReceived),
      settlementDate: s.settlementDate ? toDateString(s.settlementDate) : null,
      paymentDate: s.settlementDate ? toDateString(s.settlementDate) : null,
      totalAmount: toNumber(s.totalAmount),
      totalCost: toNumber(s.totalCost),
      profit: toNumber(s.profit),
      notes: s.notes,
      createdAt: toIsoTimestamp(s.createdAt),
      updatedAt: toIsoTimestamp(s.updatedAt),
    };
  }
  const s = row as SqliteSale;
  return {
    id: s.id,
    businessId: s.businessId,
    date: s.date,
    time: s.time,
    clientId: s.clientId,
    department: s.department,
    paymentMethod: s.paymentMethod,
    paymentStatus: s.paymentStatus,
    amountReceived: s.amountReceived ?? 0,
    paymentDate: s.paymentDate,
    totalAmount: s.totalAmount,
    totalCost: s.totalCost,
    profit: s.profit,
    notes: s.notes,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

type SqliteGoal = typeof sqliteGoals.$inferSelect;
type PgGoal = typeof pgGoals.$inferSelect;

export function mapGoalRow(row: SqliteGoal | PgGoal): LegacyGoal {
  if (isPostgres()) {
    const g = row as PgGoal;
    return {
      id: g.id,
      businessId: fromDbBusinessId(g.businessId),
      type: g.goalType,
      targetAmount: toNumber(g.targetAmount),
      targetUnits: g.targetUnits,
      periodStart: toDateString(g.periodStart),
      periodEnd: toDateString(g.periodEnd),
      createdAt: toIsoTimestamp(g.createdAt),
      updatedAt: toIsoTimestamp(g.updatedAt),
    };
  }
  const g = row as SqliteGoal;
  return {
    id: g.id,
    businessId: g.businessId,
    type: g.type,
    targetAmount: g.targetAmount,
    targetUnits: g.targetUnits,
    periodStart: g.periodStart,
    periodEnd: g.periodEnd,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

export function resolveBusinessScopeId(businessSlug: string): string {
  return toDbBusinessId(businessSlug);
}
