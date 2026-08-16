export type DbProvider = "sqlite" | "postgres";

export function getDbProvider(): DbProvider {
  const provider = process.env.DB_PROVIDER?.toLowerCase();
  if (provider === "postgres") return "postgres";
  if (process.env.DATABASE_URL && provider !== "sqlite") return "postgres";
  return "sqlite";
}

export function isPostgres(): boolean {
  return getDbProvider() === "postgres";
}

export function isSqlite(): boolean {
  return getDbProvider() === "sqlite";
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required when DB_PROVIDER=postgres");
  }
  return url;
}
