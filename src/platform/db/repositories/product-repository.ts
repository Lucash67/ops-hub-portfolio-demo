import { eq, and, inArray } from "drizzle-orm";
import { getPostgresDb, getSqliteDb, isPostgres } from "@/platform/db";
import { mapProductRow, resolveBusinessScopeId } from "@/platform/db/mappers";
import { queryAll, queryOne, queryRun, toIsoTimestamp } from "@/platform/db/query";
import { toDbBusinessId } from "@/platform/db/business-id";
import { products as sqliteProducts } from "@/lib/db/schema";
import { products as pgProducts } from "@/lib/db/postgres/schema";
import { isAllBusinesses } from "@/lib/business-units";
import { getTenantDbIds } from "@/lib/auth/tenant-context";
import { generateId } from "@/shared/ids/generate-id";
import type { LegacyProduct } from "@/lib/db/types";

export async function listProducts(businessId: string): Promise<LegacyProduct[]> {
  const tenantIds = getTenantDbIds();
  if (tenantIds !== undefined && tenantIds.length === 0) return [];

  if (isPostgres()) {
    const db = await getPostgresDb();
    let rows;
    if (!isAllBusinesses(businessId)) {
      rows = await queryAll(
        db
          .select()
          .from(pgProducts)
          .where(eq(pgProducts.businessId, resolveBusinessScopeId(businessId))),
      );
    } else if (tenantIds !== undefined) {
      rows = await queryAll(
        db.select().from(pgProducts).where(inArray(pgProducts.businessId, tenantIds)),
      );
    } else {
      rows = await queryAll(db.select().from(pgProducts));
    }
    return rows.map(mapProductRow);
  }

  const db = getSqliteDb();
  let rows;
  if (!isAllBusinesses(businessId)) {
    rows = await queryAll(
      db.select().from(sqliteProducts).where(eq(sqliteProducts.businessId, businessId)),
    );
  } else if (tenantIds !== undefined) {
    rows = await queryAll(
      db.select().from(sqliteProducts).where(inArray(sqliteProducts.businessId, tenantIds)),
    );
  } else {
    rows = await queryAll(db.select().from(sqliteProducts));
  }
  return rows.map(mapProductRow);
}

export async function getProductById(productId: string): Promise<LegacyProduct | undefined> {
  if (isPostgres()) {
    const db = await getPostgresDb();
    const row = await queryOne(
      db.select().from(pgProducts).where(eq(pgProducts.id, productId)),
    );
    return row ? mapProductRow(row) : undefined;
  }
  const db = getSqliteDb();
  const row = await queryOne(
    db.select().from(sqliteProducts).where(eq(sqliteProducts.id, productId)),
  );
  return row ? mapProductRow(row) : undefined;
}

export async function createProduct(input: {
  businessId: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stockQuantity: number;
  minStock: number;
  imageUrl?: string | null;
  status?: "active" | "inactive";
  supplierId?: string | null;
}): Promise<string> {
  const id = generateId();
  const now = new Date();

  if (isPostgres()) {
    const db = await getPostgresDb();
    await queryRun(
      db.insert(pgProducts).values({
        id,
        businessId: toDbBusinessId(input.businessId),
        name: input.name,
        category: input.category,
        unitPrice: String(input.price),
        unitCost: String(input.cost),
        stockQuantity: input.stockQuantity,
        minStock: input.minStock,
        imageUrl: input.imageUrl ?? null,
        status: input.status ?? "active",
        createdAt: now,
        updatedAt: now,
      }),
    );
    return id;
  }

  const db = getSqliteDb();
  await queryRun(
    db.insert(sqliteProducts).values({
      id,
      businessId: input.businessId,
      name: input.name,
      category: input.category,
      price: input.price,
      cost: input.cost,
      supplierId: input.supplierId ?? null,
      stockQuantity: input.stockQuantity,
      soldQuantity: 0,
      minStock: input.minStock,
      imageUrl: input.imageUrl ?? null,
      status: input.status ?? "active",
      createdAt: toIsoTimestamp(now),
      updatedAt: toIsoTimestamp(now),
    }),
  );
  return id;
}

export async function updateProduct(input: {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stockQuantity: number;
  minStock: number;
  status: "active" | "inactive";
}): Promise<void> {
  const now = new Date();

  if (isPostgres()) {
    const db = await getPostgresDb();
    await queryRun(
      db
        .update(pgProducts)
        .set({
          name: input.name,
          category: input.category,
          unitPrice: String(input.price),
          unitCost: String(input.cost),
          stockQuantity: input.stockQuantity,
          minStock: input.minStock,
          status: input.status,
          updatedAt: now,
        })
        .where(eq(pgProducts.id, input.id)),
    );
    return;
  }

  const db = getSqliteDb();
  await queryRun(
    db
      .update(sqliteProducts)
      .set({
        name: input.name,
        category: input.category,
        price: input.price,
        cost: input.cost,
        stockQuantity: input.stockQuantity,
        minStock: input.minStock,
        status: input.status,
        updatedAt: toIsoTimestamp(now),
      })
      .where(eq(sqliteProducts.id, input.id)),
  );
}

export async function updateProductStock(
  productId: string,
  stockQuantity: number,
  soldQuantity?: number,
): Promise<void> {
  const now = new Date();

  if (isPostgres()) {
    const db = await getPostgresDb();
    await queryRun(
      db
        .update(pgProducts)
        .set({ stockQuantity, updatedAt: now })
        .where(eq(pgProducts.id, productId)),
    );
    return;
  }

  const db = getSqliteDb();
  await queryRun(
    db
      .update(sqliteProducts)
      .set({
        stockQuantity,
        ...(soldQuantity !== undefined ? { soldQuantity } : {}),
        updatedAt: toIsoTimestamp(now),
      })
      .where(eq(sqliteProducts.id, productId)),
  );
}
