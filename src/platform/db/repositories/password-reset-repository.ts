import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getPostgresDb, getSqliteDb, isPostgres } from "@/platform/db";
import { queryOne, queryRun, toIsoTimestamp } from "@/platform/db/query";
import { passwordResetTokens as sqliteTokens } from "@/lib/db/schema";
import { passwordResetTokens as pgTokens } from "@/lib/db/postgres/schema";
import { generateId } from "@/shared/ids/generate-id";

const RESET_TTL_MS = 60 * 60 * 1000;

export function createResetTokenValue(): string {
  return randomBytes(32).toString("hex");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = createResetTokenValue();
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  const now = new Date();

  if (isPostgres()) {
    const db = await getPostgresDb();
    await queryRun(
      db.insert(pgTokens).values({
        userId,
        tokenHash,
        expiresAt,
        createdAt: now,
      }),
    );
    return token;
  }

  const db = getSqliteDb();
  await queryRun(
    db.insert(sqliteTokens).values({
      id: generateId(),
      userId,
      tokenHash,
      expiresAt: toIsoTimestamp(expiresAt),
      usedAt: null,
      createdAt: toIsoTimestamp(now),
    }),
  );
  return token;
}

export async function findValidResetToken(token: string): Promise<{ userId: string; id: string } | undefined> {
  const tokenHash = hashResetToken(token);
  const now = new Date();

  if (isPostgres()) {
    const db = await getPostgresDb();
    const row = await queryOne(
      db
        .select()
        .from(pgTokens)
        .where(
          and(
            eq(pgTokens.tokenHash, tokenHash),
            gt(pgTokens.expiresAt, now),
            isNull(pgTokens.usedAt),
          ),
        ),
    );
    return row ? { userId: row.userId, id: row.id } : undefined;
  }

  const db = getSqliteDb();
  const row = await queryOne(
    db.select().from(sqliteTokens).where(eq(sqliteTokens.tokenHash, tokenHash)),
  );
  if (!row || row.usedAt) return undefined;
  if (new Date(row.expiresAt) <= now) return undefined;
  return { userId: row.userId, id: row.id };
}

export async function markResetTokenUsed(id: string): Promise<void> {
  const now = new Date();

  if (isPostgres()) {
    const db = await getPostgresDb();
    await queryRun(
      db.update(pgTokens).set({ usedAt: now }).where(eq(pgTokens.id, id)),
    );
    return;
  }

  const db = getSqliteDb();
  await queryRun(
    db.update(sqliteTokens).set({ usedAt: toIsoTimestamp(now) }).where(eq(sqliteTokens.id, id)),
  );
}
