import { and, eq } from "drizzle-orm";
import { getPostgresDb, isPostgres, runInTransactionAsync } from "@/platform/db";
import { toDbBusinessId } from "@/platform/db/business-id";
import { queryOne, queryRun } from "@/platform/db/query";
import { operationDays } from "@/lib/db/postgres/schema";
import { generateId } from "@/shared/ids/generate-id";

export async function ensureOperationDayId(
  businessSlug: string,
  operationDate: string,
): Promise<string> {
  if (!isPostgres()) {
    return `${businessSlug}:${operationDate}`;
  }

  const db = await getPostgresDb();
  const businessId = toDbBusinessId(businessSlug);

  const existing = await queryOne(
    db
      .select()
      .from(operationDays)
      .where(
        and(eq(operationDays.businessId, businessId), eq(operationDays.operationDate, operationDate)),
      ),
  );

  if (existing) return existing.id;

  const id = generateId();
  const now = new Date();
  await queryRun(
    db.insert(operationDays).values({
      id,
      businessId,
      operationDate,
      status: "open",
      createdAt: now,
      updatedAt: now,
    }),
  );
  return id;
}

export async function withDbTransaction<T>(fn: () => Promise<T>): Promise<T> {
  return runInTransactionAsync(fn);
}
