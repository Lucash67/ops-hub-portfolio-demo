import type { SQL } from "drizzle-orm";
import { isPostgres } from "./config";

type SqliteAllQuery<T> = { all: () => T[] };
type SqliteGetQuery<T> = { get: () => T | undefined };
type SqliteRunQuery = { run: () => unknown };

export async function queryAll<T>(query: SqliteAllQuery<T> | Promise<T[]>): Promise<T[]> {
  if (isPostgres()) {
    return await (query as Promise<T[]>);
  }
  return (query as SqliteAllQuery<T>).all();
}

export async function queryOne<T>(
  query: SqliteGetQuery<T> | Promise<T[]>,
): Promise<T | undefined> {
  if (isPostgres()) {
    const rows = await (query as Promise<T[]>);
    return rows[0];
  }
  return (query as SqliteGetQuery<T>).get();
}

export async function queryRun(query: SqliteRunQuery | Promise<unknown>): Promise<void> {
  if (isPostgres()) {
    await query;
    return;
  }
  (query as SqliteRunQuery).run();
}

export async function queryExecute(query: Promise<unknown> | { run: () => unknown }): Promise<void> {
  await queryRun(query as SqliteRunQuery | Promise<unknown>);
}

/** Normaliza NUMERIC do Postgres (string) para number na API legada. */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

/** ISO string para campos TIMESTAMPTZ / TEXT legado. */
export function toIsoTimestamp(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : value;
}

/** DATE como yyyy-MM-dd. */
export function toDateString(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export type DbCondition = SQL | undefined;
