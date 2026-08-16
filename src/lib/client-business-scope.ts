import { eq } from "drizzle-orm";
import { isPostgres } from "@/platform/db/config";
import { getSqliteDb } from "@/platform/db/sqlite/client";
import { fetchMetricSales } from "@/platform/db/data-access/metrics";
import { clients, sales } from "@/lib/db/schema";
import { isAllBusinesses } from "@/lib/business-units";

/** Mapa clientId → business_ids em que o cliente já comprou. */
export async function buildClientSaleBusinessMap(): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  const salesRows = await fetchMetricSales();

  for (const sale of salesRows) {
    if (!sale.clientId || !sale.businessId) continue;
    const set = map.get(sale.clientId) ?? new Set<string>();
    set.add(sale.businessId);
    map.set(sale.clientId, set);
  }

  return map;
}

export function clientBelongsToBusiness(
  client: { id: string; businessId?: string | null },
  businessId: string,
  saleBusinessMap: Map<string, Set<string>>,
): boolean {
  if (isAllBusinesses(businessId)) return true;
  if (client.businessId && client.businessId === businessId) return true;
  return saleBusinessMap.get(client.id)?.has(businessId) ?? false;
}

export async function filterClientsForBusiness<T extends { id: string; businessId?: string }>(
  clientRows: T[],
  businessId: string,
  saleBusinessMap?: Map<string, Set<string>>,
): Promise<T[]> {
  if (isAllBusinesses(businessId)) return clientRows;
  const map = saleBusinessMap ?? (await buildClientSaleBusinessMap());
  return clientRows.filter((client) => clientBelongsToBusiness(client, businessId, map));
}

/** Corrige business_id de clientes com histórico exclusivo em uma operação (SQLite only). */
export function backfillClientBusinessIds(): void {
  if (isPostgres()) return;

  const db = getSqliteDb();
  const allClients = db.select().from(clients).all();
  const saleMap = new Map<string, Set<string>>();

  for (const sale of db
    .select({ clientId: sales.clientId, businessId: sales.businessId })
    .from(sales)
    .all()) {
    if (!sale.clientId) continue;
    const set = saleMap.get(sale.clientId) ?? new Set<string>();
    set.add(sale.businessId);
    saleMap.set(sale.clientId, set);
  }

  for (const client of allClients) {
    const ops = saleMap.get(client.id);
    if (!ops || ops.size !== 1) continue;
    const onlyOp = Array.from(ops)[0];
    if (client.businessId !== onlyOp) {
      db.update(clients)
        .set({ businessId: onlyOp, updatedAt: new Date().toISOString() })
        .where(eq(clients.id, client.id))
        .run();
    }
  }
}
