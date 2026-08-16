import { eq } from "drizzle-orm";
import { getPostgresDb, runInTransactionAsync } from "@/platform/db";
import { getProductById, updateProductStock } from "@/platform/db/repositories/product-repository";
import { queryOne, queryRun } from "@/platform/db/query";
import { saleItems as pgSaleItems, sales as pgSales } from "@/lib/db/postgres/schema";

/** Recalcula totais de uma venda a partir do preço/custo do produto e da quantidade. */
export async function recalculateSaleAmounts(saleId: string, quantity: number): Promise<void> {
  const db = await getPostgresDb();
  const sale = await queryOne(db.select().from(pgSales).where(eq(pgSales.id, saleId)));
  if (!sale) throw new Error(`Venda não encontrada: ${saleId}`);

  const item = await queryOne(
    db.select().from(pgSaleItems).where(eq(pgSaleItems.saleId, saleId)),
  );
  if (!item) throw new Error(`Item não encontrado para venda: ${saleId}`);

  const product = await getProductById(item.productId);
  if (!product) throw new Error(`Produto não encontrado: ${item.productId}`);

  const qtyDelta = quantity - item.quantity;
  const subtotal = product.price * quantity;
  const cost = product.cost * quantity;
  const profit = subtotal - cost;
  const now = new Date();

  await runInTransactionAsync(async () => {
    await queryRun(
      db
        .update(pgSaleItems)
        .set({
          quantity,
          unitPrice: String(product.price),
          unitCost: String(product.cost),
          subtotal: String(subtotal),
          profit: String(profit),
        })
        .where(eq(pgSaleItems.id, item.id)),
    );

    await queryRun(
      db
        .update(pgSales)
        .set({
          totalAmount: String(subtotal),
          totalCost: String(cost),
          profit: String(profit),
          updatedAt: now,
        })
        .where(eq(pgSales.id, saleId)),
    );

    if (qtyDelta !== 0) {
      await updateProductStock(product.id, Math.max(0, product.stockQuantity - qtyDelta));
    }
  });
}

/** Remove venda e reverte estoque do produto (correções administrativas). */
export async function removeSaleWithRollback(saleId: string): Promise<void> {
  const db = await getPostgresDb();
  const sale = await queryOne(db.select().from(pgSales).where(eq(pgSales.id, saleId)));
  if (!sale) return;

  const item = await queryOne(
    db.select().from(pgSaleItems).where(eq(pgSaleItems.saleId, saleId)),
  );
  const product = item ? await getProductById(item.productId) : null;

  await runInTransactionAsync(async () => {
    if (item && product) {
      await updateProductStock(product.id, product.stockQuantity + item.quantity);
    }
    await queryRun(db.delete(pgSaleItems).where(eq(pgSaleItems.saleId, saleId)));
    await queryRun(db.delete(pgSales).where(eq(pgSales.id, saleId)));
  });
}
