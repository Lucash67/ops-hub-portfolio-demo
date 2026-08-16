import { eq } from "drizzle-orm";
import { getPostgresDb, getSqliteDb, isPostgres } from "@/platform/db";
import { queryAll, queryOne, queryRun, toIsoTimestamp } from "@/platform/db/query";
import { settings as sqliteSettings } from "@/lib/db/schema";
import { appSettings as pgSettings } from "@/lib/db/postgres/schema";

export async function listSettingsMap(): Promise<Record<string, string>> {
  if (isPostgres()) {
    const db = await getPostgresDb();
    const rows = await queryAll(db.select().from(pgSettings));
    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.key] =
        typeof row.value === "string" ? row.value : JSON.stringify(row.value ?? "");
    }
    return map;
  }

  const db = getSqliteDb();
  const rows = await queryAll(db.select().from(sqliteSettings));
  return Object.fromEntries(rows.map((s) => [s.key, s.value]));
}

export async function upsertSetting(key: string, value: string): Promise<void> {
  const now = new Date();

  if (isPostgres()) {
    const db = await getPostgresDb();
    const existing = await queryOne(
      db.select().from(pgSettings).where(eq(pgSettings.key, key)),
    );
    const jsonValue = tryParseJson(value);
    if (existing) {
      await queryRun(
        db
          .update(pgSettings)
          .set({ value: jsonValue, updatedAt: now })
          .where(eq(pgSettings.key, key)),
      );
    } else {
      await queryRun(
        db.insert(pgSettings).values({ key, value: jsonValue, updatedAt: now }),
      );
    }
    return;
  }

  const db = getSqliteDb();
  const existing = await queryOne(
    db.select().from(sqliteSettings).where(eq(sqliteSettings.key, key)),
  );
  if (existing) {
    await queryRun(
      db
        .update(sqliteSettings)
        .set({ value, updatedAt: toIsoTimestamp(now) })
        .where(eq(sqliteSettings.key, key)),
    );
  } else {
    await queryRun(
      db.insert(sqliteSettings).values({
        key,
        value,
        updatedAt: toIsoTimestamp(now),
      }),
    );
  }
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function isPostgresBackupSupported(): boolean {
  return !isPostgres();
}
