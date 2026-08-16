import { eq, inArray } from "drizzle-orm";
import { getPostgresDb, getSqliteDb, isPostgres } from "@/platform/db";
import { mapProductRow, resolveBusinessScopeId } from "@/platform/db/mappers";
import { queryAll, queryRun, toIsoTimestamp } from "@/platform/db/query";
import { toDbBusinessId } from "@/platform/db/business-id";
import { products as sqliteProducts, stockMovements as sqliteStockMovements } from "@/lib/db/schema";
import { products as pgProducts, stockMovements as pgStockMovements } from "@/lib/db/postgres/schema";
import { isAllBusinesses } from "@/lib/business-units";
import { getTenantDbIds } from "@/lib/auth/tenant-context";
import { generateId } from "@/shared/ids/generate-id";

export async function listStockProducts(businessId: string) {
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

export async function recordStockMovement(input: {
  productId: string;
  type: "entry" | "exit" | "adjustment";
  quantity: number;
  balanceAfter: number;
  reason?: string | null;
}): Promise<void> {
  const now = new Date();
  const id = generateId();

  if (isPostgres()) {
    const db = await getPostgresDb();
    await queryRun(
      db.insert(pgStockMovements).values({
        id,
        productId: input.productId,
        movementType: input.type,
        quantity: input.quantity,
        balanceAfter: input.balanceAfter,
        reason: input.reason ?? null,
        createdAt: now,
      }),
    );
    return;
  }

  const db = getSqliteDb();
  await queryRun(
    db.insert(sqliteStockMovements).values({
      id,
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      balanceAfter: input.balanceAfter,
      reason: input.reason ?? null,
      createdAt: toIsoTimestamp(now),
    }),
  );
}

export async function updateStockQuantity(productId: string, stockQuantity: number): Promise<void> {
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
      .set({ stockQuantity, updatedAt: toIsoTimestamp(now) })
      .where(eq(sqliteProducts.id, productId)),
  );
}
