import { NextRequest, NextResponse } from "next/server";
import { getLowStockProducts } from "@/lib/analytics";
import { MSG, apiError } from "@/shared/api-messages";
import { getProductById } from "@/platform/db/repositories/product-repository";
import {
  listStockProducts,
  recordStockMovement,
  updateStockQuantity,
} from "@/platform/db/repositories/stock-repository";
import { getPostgresDb, getSqliteDb, isPostgres } from "@/platform/db";
import { queryAll } from "@/platform/db/query";
import { stockMovements as sqliteStockMovements } from "@/lib/db/schema";
import { stockMovements as pgStockMovements } from "@/lib/db/postgres/schema";
import { desc } from "drizzle-orm";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";
import { requireTenantBusinessWrite } from "@/lib/auth/tenant-scope";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      const businessId = scope.businessId;
      const allProducts = await listStockProducts(businessId);
      const productIds = new Set(allProducts.map((p) => p.id));

      let rawMovements;
      if (isPostgres()) {
        const db = await getPostgresDb();
        rawMovements = await queryAll(
          db.select().from(pgStockMovements).orderBy(desc(pgStockMovements.createdAt)).limit(50),
        );
      } else {
        const db = getSqliteDb();
        rawMovements = await queryAll(
          db.select().from(sqliteStockMovements).orderBy(desc(sqliteStockMovements.createdAt)).limit(50),
        );
      }

      const movements = rawMovements
        .filter((m) => productIds.has(m.productId))
        .map((m) => ({
          id: m.id,
          productId: m.productId,
          type: isPostgres()
            ? (m as typeof pgStockMovements.$inferSelect).movementType
            : (m as typeof sqliteStockMovements.$inferSelect).type,
          quantity: m.quantity,
          balanceAfter: m.balanceAfter,
          reason: m.reason,
          createdAt: isPostgres()
            ? (m as typeof pgStockMovements.$inferSelect).createdAt
            : (m as typeof sqliteStockMovements.$inferSelect).createdAt,
        }));

      const lowStock = await getLowStockProducts(businessId);
      const productMap = new Map(allProducts.map((p) => [p.id, p]));
      const enrichedMovements = movements.map((m) => ({
        ...m,
        product: productMap.get(m.productId),
      }));

      return NextResponse.json({
        products: allProducts,
        movements: enrichedMovements,
        lowStock,
      });
    });
  } catch (error) {
    console.error("Stock GET error:", error);
    return apiError(MSG.LOAD_STOCK);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    const body = await request.json();
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      const businessId = requireTenantBusinessWrite(scope, request.nextUrl.searchParams.get("businessId"));
      const { productId, type, quantity, reason } = body;

      const product = await getProductById(productId);
      if (!product) return apiError(MSG.STOCK_PRODUCT_NOT_FOUND, 404);

      if (product.businessId !== businessId) {
        return apiError("Produto não pertence à operação selecionada.", 400);
      }

      const qty = Number(quantity);
      if (!qty || qty <= 0) {
        return apiError("Informe uma quantidade válida.", 400);
      }

      let newBalance = product.stockQuantity;
      if (type === "entry") newBalance += qty;
      else if (type === "exit") newBalance = Math.max(0, newBalance - qty);
      else newBalance = qty;

      await updateStockQuantity(productId, newBalance);
      await recordStockMovement({
        productId,
        type,
        quantity: qty,
        balanceAfter: newBalance,
        reason: reason || null,
      });

      return NextResponse.json({ success: true, balance: newBalance });
    });
  } catch (error) {
    console.error("Stock POST error:", error);
    if (error instanceof Error && error.message.includes("operação específica")) {
      return apiError(error.message, 400);
    }
    return apiError(MSG.UPDATE_STOCK);
  }
}
