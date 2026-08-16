import { isPostgres } from "./config";
import { getPostgresDb } from "./postgres/client";
import {
  DB_PATH,
  getSqlite,
  getSqliteDb,
  runSqliteTransaction,
} from "./sqlite/client";

export { DB_PATH };

/** Schema ativo — resolvido preguiçosamente para evitar ciclo sqlite ↔ index no bootstrap tsx. */
export function getActiveSchema() {
  if (isPostgres()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./postgres/client").postgresSchema;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./sqlite/client").sqliteSchema;
}

/** @deprecated Prefer getDbAsync() — sync only works with SQLite. */
export function getDb() {
  if (isPostgres()) {
    throw new Error(
      "getDb() is synchronous and only supported for SQLite. Use getDbAsync() with DB_PROVIDER=postgres.",
    );
  }
  return getSqliteDb();
}

export async function getDbAsync() {
  if (isPostgres()) {
    return getPostgresDb();
  }
  return getSqliteDb();
}

export function getSqliteRaw() {
  if (isPostgres()) {
    throw new Error("getSqliteRaw() is only available with SQLite.");
  }
  return getSqlite();
}

/** @deprecated Prefer runInTransactionAsync() for cross-provider support. */
export function runInTransaction<T>(fn: () => T): T {
  if (isPostgres()) {
    throw new Error("Use runInTransactionAsync() with DB_PROVIDER=postgres.");
  }
  return runSqliteTransaction(fn);
}

export async function runInTransactionAsync<T>(fn: () => Promise<T> | T): Promise<T> {
  if (isPostgres()) {
    const db = await getPostgresDb();
    return db.transaction(async () => fn());
  }
  // better-sqlite3 nao aceita Promise dentro de transaction().
  // Callbacks async (ex.: executeSaleRecord) rodam sem wrapper sync.
  const result = fn();
  if (result != null && typeof (result as Promise<T>).then === "function") {
    return result as Promise<T>;
  }
  return runSqliteTransaction(() => result as T);
}

export { isPostgres, isSqlite, getDbProvider } from "./config";
export { getPostgresDb, closePostgresConnection } from "./postgres/client";
export { getSqliteDb, getSqlite, runSqliteTransaction } from "./sqlite/client";
