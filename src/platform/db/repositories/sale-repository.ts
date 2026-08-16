import { desc, eq, and, inArray } from "drizzle-orm";
import { format } from "date-fns";
import { getPostgresDb, getSqliteDb, isPostgres, runInTransactionAsync } from "@/platform/db";
import { mapSaleRow, resolveBusinessScopeId } from "@/platform/db/mappers";
import { ensureOperationDayId } from "@/platform/db/repositories/operation-day-repository";
import { getProductById, updateProductStock } from "@/platform/db/repositories/product-repository";
import { queryAll, queryOne, queryRun, toIsoTimestamp } from "@/platform/db/query";
import { toDbBusinessId } from "@/platform/db/business-id";
import {
  clients as sqliteClients,
  products as sqliteProducts,
  saleItems as sqliteSaleItems,
  sales as sqliteSales,
  payments as sqlitePayments,
} from "@/lib/db/schema";
import {
  saleItems as pgSaleItems,
  sales as pgSales,
  stockMovements as pgStockMovements,
} from "@/lib/db/postgres/schema";
import { isAllBusinesses } from "@/lib/business-units";
import { getTenantDbIds } from "@/lib/auth/tenant-context";
import {
  inferPaymentStatusFromNotes,
  resolveAmountReceived,
  type PaymentStatus,
} from "@/lib/operational-data-service";
import { normalizeSaleShiftTime } from "@/lib/sale-shift";
import { generateId } from "@/shared/ids/generate-id";
import type { LegacyProduct, LegacySale } from "@/lib/db/types";
import { mapProductRow, mapClientRow } from "@/platform/db/mappers";
import { clients as pgClients, products as pgProducts } from "@/lib/db/postgres/schema";

export async function listSalesEnriched(businessId: string) {
  const tenantIds = getTenantDbIds();
  if (tenantIds !== undefined && tenantIds.length === 0) return [];

  let salesRows: LegacySale[];

  if (isPostgres()) {
    const db = await getPostgresDb();
    let raw;
    if (!isAllBusinesses(businessId)) {
      raw = await queryAll(
        db
          .select()
          .from(pgSales)
          .where(eq(pgSales.businessId, resolveBusinessScopeId(businessId)))
          .orderBy(desc(pgSales.saleDate), desc(pgSales.saleTime)),
      );
    } else if (tenantIds !== undefined) {
      raw = await queryAll(
        db
          .select()
          .from(pgSales)
          .where(inArray(pgSales.businessId, tenantIds))
          .orderBy(desc(pgSales.saleDate), desc(pgSales.saleTime)),
      );
    } else {
      raw = await queryAll(
        db.select().from(pgSales).orderBy(desc(pgSales.saleDate), desc(pgSales.saleTime)),
      );
    }
    salesRows = raw.map(mapSaleRow);

    const productConditions =
      tenantIds !== undefined && isAllBusinesses(businessId)
        ? inArray(pgProducts.businessId, tenantIds)
        : undefined;
    const clients = (await queryAll(db.select().from(pgClients))).map(mapClientRow);
    const products = productConditions
      ? (await queryAll(db.select().from(pgProducts).where(productConditions))).map(mapProductRow)
      : (await queryAll(db.select().from(pgProducts))).map(mapProductRow);
    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const productMap = new Map(products.map((p) => [p.id, p]));

    const saleIds = salesRows.map((s) => s.id);
    const allItems =
      saleIds.length > 0
        ? await queryAll(
            db.select().from(pgSaleItems).where(inArray(pgSaleItems.saleId, saleIds)),
          )
        : [];
    const itemsBySale = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const list = itemsBySale.get(item.saleId) ?? [];
      list.push(item);
      itemsBySale.set(item.saleId, list);
    }

    return salesRows.map((sale) => ({
      ...sale,
      client: sale.clientId ? clientMap.get(sale.clientId) ?? null : null,
      items: (itemsBySale.get(sale.id) ?? []).map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        unitCost: Number(item.unitCost),
        subtotal: Number(item.subtotal),
        profit: Number(item.profit),
        product: productMap.get(item.productId),
      })),
    }));
  }

  const db = getSqliteDb();
  let raw;
  if (!isAllBusinesses(businessId)) {
    raw = await queryAll(
      db
        .select()
        .from(sqliteSales)
        .where(eq(sqliteSales.businessId, businessId))
        .orderBy(desc(sqliteSales.date), desc(sqliteSales.time)),
    );
  } else if (tenantIds !== undefined) {
    raw = await queryAll(
      db
        .select()
        .from(sqliteSales)
        .where(inArray(sqliteSales.businessId, tenantIds))
        .orderBy(desc(sqliteSales.date), desc(sqliteSales.time)),
    );
  } else {
    raw = await queryAll(
      db.select().from(sqliteSales).orderBy(desc(sqliteSales.date), desc(sqliteSales.time)),
    );
  }
  salesRows = raw.map(mapSaleRow);

  const products =
    tenantIds !== undefined && isAllBusinesses(businessId)
      ? (await queryAll(
          db.select().from(sqliteProducts).where(inArray(sqliteProducts.businessId, tenantIds)),
        )).map(mapProductRow)
      : (await queryAll(db.select().from(sqliteProducts))).map(mapProductRow);
  const clients = (await queryAll(db.select().from(sqliteClients))).map(mapClientRow);
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  const saleIds = salesRows.map((s) => s.id);
  const allItems =
    saleIds.length > 0
      ? await queryAll(
          db.select().from(sqliteSaleItems).where(inArray(sqliteSaleItems.saleId, saleIds)),
        )
      : [];
  const itemsBySale = new Map<string, typeof allItems>();
  for (const item of allItems) {
    const list = itemsBySale.get(item.saleId) ?? [];
    list.push(item);
    itemsBySale.set(item.saleId, list);
  }

  return salesRows.map((sale) => ({
    ...sale,
    client: sale.clientId ? clientMap.get(sale.clientId) ?? null : null,
    items: (itemsBySale.get(sale.id) ?? []).map((item) => ({
      ...item,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost,
      subtotal: item.subtotal,
      profit: item.profit,
      product: productMap.get(item.productId),
    })),
  }));
}

/** Contagem rápida de vendas por data — evita carregar todo o histórico enriquecido. */
export async function countSalesForDate(businessId: string, saleDate: string): Promise<number> {
  if (isPostgres()) {
    const db = await getPostgresDb();
    const rows = await queryAll(
      db
        .select({ id: pgSales.id })
        .from(pgSales)
        .where(
          and(
            eq(pgSales.businessId, toDbBusinessId(businessId)),
            eq(pgSales.saleDate, saleDate),
          ),
        ),
    );
    return rows.length;
  }

  const db = getSqliteDb();
  const rows = await queryAll(
    db
      .select({ id: sqliteSales.id })
      .from(sqliteSales)
      .where(and(eq(sqliteSales.businessId, businessId), eq(sqliteSales.date, saleDate))),
  );
  return rows.length;
}

export interface ExecuteSaleInput {
  productId: string;
  quantity: number;
  clientId?: string | null;
  paymentMethod: "pix" | "card" | "cash";
  paymentStatus?: PaymentStatus;
  date?: string;
  time?: string;
  department?: string | null;
  notes?: string | null;
  /** Sobrescreve preço/custo do catálogo (ex.: Registro do Dia com faturamento explícito). */
  unitPrice?: number;
  unitCost?: number;
}

export async function executeSaleRecord(input: ExecuteSaleInput): Promise<string> {
  const product = await getProductById(input.productId);
  if (!product) {
    throw new Error("Produto não encontrado. Cadastre o produto antes de vender.");
  }

  const qty = input.quantity;
  if (qty <= 0) {
    throw new Error("Informe uma quantidade válida (mínimo 1).");
  }

  const unitPrice = input.unitPrice ?? product.price;
  const unitCost = input.unitCost ?? product.cost;
  const subtotal = unitPrice * qty;
  const cost = unitCost * qty;
  const profit = subtotal - cost;
  const now = new Date();
  const saleId = generateId();
  const saleItemId = generateId();
  const saleDate = input.date ?? format(now, "yyyy-MM-dd");
  const saleTime = normalizeSaleShiftTime(input.time ?? format(now, "HH:mm"));
  const paymentStatus = input.paymentStatus ?? inferPaymentStatusFromNotes(input.notes);
  const amountReceived = resolveAmountReceived(subtotal, paymentStatus);
  const stockBefore = product.stockQuantity;
  const stockAfter = Math.max(0, product.stockQuantity - qty);

  await runInTransactionAsync(async () => {
    if (isPostgres()) {
      const db = await getPostgresDb();
      const operationDayId = await ensureOperationDayId(product.businessId, saleDate);
      await queryRun(
        db.insert(pgSales).values({
          id: saleId,
          businessId: toDbBusinessId(product.businessId),
          operationDayId,
          clientId: input.clientId ?? null,
          saleDate,
          saleTime: `${saleTime}:00`,
          department: input.department ?? null,
          paymentMethod: input.paymentMethod,
          paymentStatus,
          amountReceived: String(amountReceived),
          totalAmount: String(subtotal),
          totalCost: String(cost),
          profit: String(profit),
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
        }),
      );
      await queryRun(
        db.insert(pgSaleItems).values({
          id: saleItemId,
          saleId,
          productId: input.productId,
          quantity: qty,
          unitPrice: String(unitPrice),
          unitCost: String(unitCost),
          subtotal: String(subtotal),
          profit: String(profit),
          flavorConfidence: "confirmed",
        }),
      );
      await queryRun(
        db.insert(pgStockMovements).values({
          productId: input.productId,
          operationDayId,
          saleId,
          movementType: "exit",
          quantity: qty,
          balanceAfter: stockAfter,
          reason: "sale",
          createdAt: now,
        }),
      );
      await updateProductStock(input.productId, stockAfter);
      return;
    }

    const db = getSqliteDb();
    const paymentId = generateId();
    await queryRun(
      db.insert(sqliteSales).values({
        id: saleId,
        businessId: product.businessId,
        date: saleDate,
        time: saleTime,
        clientId: input.clientId ?? null,
        department: input.department ?? null,
        paymentMethod: input.paymentMethod,
        paymentStatus,
        amountReceived,
        totalAmount: subtotal,
        totalCost: cost,
        profit,
        notes: input.notes ?? null,
        createdAt: toIsoTimestamp(now),
        updatedAt: toIsoTimestamp(now),
      }),
    );
    await queryRun(
      db.insert(sqliteSaleItems).values({
        id: saleItemId,
        saleId,
        productId: input.productId,
        quantity: qty,
        unitPrice,
        unitCost,
        subtotal,
        profit,
      }),
    );
    await queryRun(
      db.insert(sqlitePayments).values({
        id: paymentId,
        saleId,
        method: input.paymentMethod,
        amount: amountReceived > 0 ? amountReceived : subtotal,
        createdAt: toIsoTimestamp(now),
      }),
    );
    await updateProductStock(input.productId, stockAfter, product.soldQuantity + qty);
  });

  return saleId;
}

export async function getSaleProduct(productId: string): Promise<LegacyProduct | undefined> {
  return getProductById(productId);
}
