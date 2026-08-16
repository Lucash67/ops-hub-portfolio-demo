import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as pgSchema from "@/lib/db/postgres/schema";
import { getDatabaseUrl } from "@/platform/db/config";

const schema = pgSchema;

let client: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let initPromise: Promise<void> | null = null;

async function ensureAuthAndTenantColumns(): Promise<void> {
  if (!client) return;
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens (token_hash);
    CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens (user_id);

    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses (owner_id);
    ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_slug_key;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_owner_slug ON businesses (owner_id, slug);

    UPDATE businesses
    SET owner_id = (SELECT id FROM users WHERE email = 'lucashcampos667@gmail.com' LIMIT 1)
    WHERE owner_id IS NULL;
  `);
}

export async function getPostgresDb() {
  if (dbInstance) {
    if (initPromise) await initPromise;
    return dbInstance;
  }

  client = postgres(getDatabaseUrl(), { prepare: false, max: 10 });
  dbInstance = drizzle(client, { schema });
  initPromise = ensureAuthAndTenantColumns();
  await initPromise;
  return dbInstance;
}

export async function runPostgresTransaction<T>(fn: (db: NonNullable<typeof dbInstance>) => Promise<T>): Promise<T> {
  const db = await getPostgresDb();
  return db.transaction(fn);
}

export async function closePostgresConnection(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    dbInstance = null;
    initPromise = null;
  }
}

export { schema as postgresSchema };
