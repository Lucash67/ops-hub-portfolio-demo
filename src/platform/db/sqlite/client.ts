import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import * as legacySchema from "@/lib/db/schema";
import * as operationsSchema from "../schema-operations";
import {
  BRIGADEIROS_BUSINESS_ID,
  SALGADOS_BUSINESS_ID,
} from "@/lib/business-units";

function openDatabase(dbPath: string): Database.Database {
  // Lazy require â€” avoids native build on Postgres-only deploys (e.g. Vercel).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BetterSqlite3 = require("better-sqlite3") as new (filename: string) => Database.Database;
  return new BetterSqlite3(dbPath);
}

function resolveDataDir() {
  // Vercel filesystem is read-only except /tmp — demo SQLite vive aqui (sem Supabase).
  if (process.env.VERCEL || process.env.DEMO_SQLITE_TMP === "true") {
    return path.join("/tmp", "ops-hub-demo");
  }
  return path.join(process.cwd(), "data");
}

export const DATA_DIR = resolveDataDir();
export const DB_PATH = path.join(DATA_DIR, "ops-hub-demo.db");

const schema = { ...legacySchema, ...operationsSchema };

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initBusinessUnitsTable(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS business_units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const columns = sqlite.prepare("PRAGMA table_info(business_units)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "owner_id")) {
    sqlite.exec("ALTER TABLE business_units ADD COLUMN owner_id TEXT");
    sqlite.exec(`
      UPDATE business_units
      SET owner_id = (SELECT id FROM users LIMIT 1)
      WHERE owner_id IS NULL AND EXISTS (SELECT 1 FROM users LIMIT 1);
    `);
  }
}

function migrateLegacyBusinessIdColumns(sqlite: Database.Database) {
  const scopedTables = ["products", "sales", "goals", "investments"] as const;

  for (const table of scopedTables) {
    const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    const existing = new Set(columns.map((c) => c.name));
    if (!existing.has("business_id")) {
      sqlite.exec(
        `ALTER TABLE ${table} ADD COLUMN business_id TEXT NOT NULL DEFAULT '${SALGADOS_BUSINESS_ID}'`,
      );
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_business ON ${table}(business_id)`);
    }
  }

  sqlite.exec(`
    UPDATE products SET business_id = '${SALGADOS_BUSINESS_ID}'
    WHERE business_id IS NULL OR business_id = '' OR business_id = 'default';
    UPDATE sales SET business_id = '${SALGADOS_BUSINESS_ID}'
    WHERE business_id IS NULL OR business_id = '' OR business_id = 'default';
    UPDATE goals SET business_id = '${SALGADOS_BUSINESS_ID}'
    WHERE business_id IS NULL OR business_id = '' OR business_id = 'default';
    UPDATE investments SET business_id = '${SALGADOS_BUSINESS_ID}'
    WHERE business_id IS NULL OR business_id = '' OR business_id = 'default';
  `);
  const opsExists = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='operations'")
    .get();
  if (opsExists) {
    sqlite.exec(`
      UPDATE operations SET business_id = '${SALGADOS_BUSINESS_ID}'
      WHERE business_id = 'default';
    `);
  }
}

function seedSalgadosAdditionalInvestmentIfMissing(sqlite: Database.Database) {
  const existing = sqlite
    .prepare("SELECT id FROM investments WHERE business_id = ? AND date = ? AND amount = 42")
    .get(SALGADOS_BUSINESS_ID, "2026-07-17") as { id: string } | undefined;
  if (existing) return;

  const now = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT INTO investments (id, business_id, description, amount, type, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "acal-inv-2026-07-17-42",
      SALGADOS_BUSINESS_ID,
      "Investimento R$42,00 (pai do operador) â€” aquisiÃ§Ã£o de produtos ACAL. Dia 17/07/2026.",
      42,
      "additional",
      "2026-07-17",
      now,
    );
}

function seedBusinessUnits(sqlite: Database.Database) {
  const now = new Date().toISOString();
  const insert = sqlite.prepare(`
    INSERT OR IGNORE INTO business_units (id, name, slug, status, created_at, updated_at)
    VALUES (?, ?, ?, 'active', ?, ?)
  `);
  insert.run(SALGADOS_BUSINESS_ID, "Salty", "salgados", now, now);
  insert.run(BRIGADEIROS_BUSINESS_ID, "Candy", "brigadeiros", now, now);
}

function seedBrigadeirosGoalsIfMissing(sqlite: Database.Database) {
  const count = sqlite
    .prepare("SELECT COUNT(*) AS c FROM goals WHERE business_id = ?")
    .get(BRIGADEIROS_BUSINESS_ID) as { c: number };

  if (count.c > 0) return;

  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const types = ["daily", "weekly", "monthly", "yearly"] as const;
  const insert = sqlite.prepare(`
    INSERT INTO goals (id, business_id, type, target_amount, target_units, period_start, period_end, created_at, updated_at)
    VALUES (?, ?, ?, 0, NULL, ?, ?, ?, ?)
  `);

  for (const type of types) {
    const id = `${BRIGADEIROS_BUSINESS_ID}-${type}`;
    insert.run(id, BRIGADEIROS_BUSINESS_ID, type, today, today, now, now);
  }
}

function initLegacyTables(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      cost REAL NOT NULL,
      supplier_id TEXT REFERENCES suppliers(id),
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      sold_quantity INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 10,
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sector TEXT,
      company TEXT,
      phone TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      client_id TEXT REFERENCES clients(id),
      department TEXT,
      payment_method TEXT NOT NULL,
      total_amount REAL NOT NULL,
      total_cost REAL NOT NULL,
      profit REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      unit_cost REAL NOT NULL,
      subtotal REAL NOT NULL,
      profit REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      target_amount REAL NOT NULL,
      target_units INTEGER,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sticky_notes (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      business_id TEXT,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT 'default',
      note_date TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      client_updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS investments (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash_flow (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_product ON stock_movements(product_id);
  `);
}

function migrateOperationsColumns(sqlite: Database.Database) {
  const columns = sqlite.prepare("PRAGMA table_info(operations)").all() as { name: string }[];
  const existing = new Set(columns.map((c) => c.name));
  const additions: [string, string][] = [
    ["duration_ms", "INTEGER"],
    ["effects_count", "INTEGER DEFAULT 0"],
    ["events_count", "INTEGER DEFAULT 0"],
    ["error_message", "TEXT"],
    ["completed_at", "TEXT"],
  ];
  for (const [name, type] of additions) {
    if (!existing.has(name)) {
      sqlite.exec(`ALTER TABLE operations ADD COLUMN ${name} ${type}`);
    }
  }
}

function initOperationsTables(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS operations (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL DEFAULT 'default',
      status TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      source TEXT NOT NULL,
      correlation_id TEXT NOT NULL,
      confidence REAL,
      duration_ms INTEGER,
      effects_count INTEGER DEFAULT 0,
      events_count INTEGER DEFAULT 0,
      error_message TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operation_payloads (
      id TEXT PRIMARY KEY,
      operation_id TEXT NOT NULL REFERENCES operations(id),
      raw_payload TEXT NOT NULL,
      payload_type TEXT NOT NULL,
      received_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operation_interpretations (
      id TEXT PRIMARY KEY,
      operation_id TEXT NOT NULL REFERENCES operations(id),
      interpretation_json TEXT NOT NULL,
      interpreted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS effect_records (
      id TEXT PRIMARY KEY,
      operation_id TEXT NOT NULL REFERENCES operations(id),
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS domain_events (
      id TEXT PRIMARY KEY,
      operation_id TEXT REFERENCES operations(id),
      event_type TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      occurred_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_operations_business_created ON operations(business_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);
    CREATE INDEX IF NOT EXISTS idx_effect_records_entity ON effect_records(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_domain_events_type_occurred ON domain_events(event_type, occurred_at DESC);
  `);
  migrateOperationsColumns(sqlite);
}

function migrateOperationalIntelligence(sqlite: Database.Database) {
  const salesColumns = sqlite.prepare("PRAGMA table_info(sales)").all() as { name: string }[];
  const salesExisting = new Set(salesColumns.map((c) => c.name));

  if (!salesExisting.has("payment_status")) {
    sqlite.exec(`ALTER TABLE sales ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'paid'`);
  }
  if (!salesExisting.has("amount_received")) {
    sqlite.exec(`ALTER TABLE sales ADD COLUMN amount_received REAL`);
  }
  if (!salesExisting.has("payment_date")) {
    sqlite.exec(`ALTER TABLE sales ADD COLUMN payment_date TEXT`);
  }

  sqlite.exec(`
    UPDATE sales SET amount_received = total_amount
    WHERE amount_received IS NULL AND (payment_status = 'paid' OR payment_status IS NULL OR payment_status = '');
    UPDATE sales SET payment_status = 'pending', amount_received = 0
    WHERE payment_status = 'paid'
      AND payment_date IS NULL
      AND (
        LOWER(COALESCE(notes, '')) LIKE '%fiado%'
        OR LOWER(COALESCE(notes, '')) LIKE '%devendo%'
        OR LOWER(COALESCE(notes, '')) LIKE '%pendente%'
      );
  `);

  const clientColumns = sqlite.prepare("PRAGMA table_info(clients)").all() as { name: string }[];
  const clientExisting = new Set(clientColumns.map((c) => c.name));
  if (!clientExisting.has("business_id")) {
    sqlite.exec(
      `ALTER TABLE clients ADD COLUMN business_id TEXT NOT NULL DEFAULT '${SALGADOS_BUSINESS_ID}'`,
    );
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_clients_business ON clients(business_id)`);
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS operational_losses (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      date TEXT NOT NULL,
      product_id TEXT REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_purchases (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      date TEXT NOT NULL,
      total_units INTEGER NOT NULL,
      investment REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL REFERENCES daily_purchases(id) ON DELETE CASCADE,
      product_id TEXT REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_cost REAL
    );

    CREATE TABLE IF NOT EXISTS operational_actions (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      source TEXT NOT NULL DEFAULT 'diary',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_hypotheses (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      date TEXT NOT NULL,
      flavor TEXT NOT NULL,
      hypothesis TEXT NOT NULL,
      confirmed INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operational_lessons (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_operational_losses_business_date ON operational_losses(business_id, date);
    CREATE INDEX IF NOT EXISTS idx_daily_purchases_business_date ON daily_purchases(business_id, date);
    CREATE INDEX IF NOT EXISTS idx_operational_actions_business_date ON operational_actions(business_id, date);
    CREATE INDEX IF NOT EXISTS idx_product_hypotheses_business_date ON product_hypotheses(business_id, date);
    CREATE INDEX IF NOT EXISTS idx_operational_lessons_business_date ON operational_lessons(business_id, date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_purchases_business_date_unique ON daily_purchases(business_id, date);
  `);
}

function initUsersTable(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);
}

function initPasswordResetTable(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
  `);
}

function migrateInvestmentSourceColumns(sqlite: Database.Database) {
  const columns = sqlite.prepare("PRAGMA table_info(investments)").all() as { name: string }[];
  const existing = new Set(columns.map((c) => c.name));

  if (!existing.has("source_type")) {
    sqlite.exec(`ALTER TABLE investments ADD COLUMN source_type TEXT`);
  }
  if (!existing.has("source_name")) {
    sqlite.exec(`ALTER TABLE investments ADD COLUMN source_name TEXT`);
  }
}

function migrateStickyNotesNoteDate(sqlite: Database.Database) {
  const columns = sqlite.prepare("PRAGMA table_info(sticky_notes)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "note_date")) {
    sqlite.exec(`ALTER TABLE sticky_notes ADD COLUMN note_date TEXT`);
  }
}

function initTables(sqlite: Database.Database) {
  initLegacyTables(sqlite);
  initUsersTable(sqlite);
  initPasswordResetTable(sqlite);
  initBusinessUnitsTable(sqlite);
  migrateLegacyBusinessIdColumns(sqlite);
  migrateOperationalIntelligence(sqlite);
  migrateInvestmentSourceColumns(sqlite);
  migrateStickyNotesNoteDate(sqlite);
  seedBusinessUnits(sqlite);
  seedBrigadeirosGoalsIfMissing(sqlite);
  seedSalgadosAdditionalInvestmentIfMissing(sqlite);
  initOperationsTables(sqlite);
}

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqliteInstance: Database.Database | null = null;

export function getSqliteDb() {
  if (dbInstance) return dbInstance;

  ensureDataDir();
  const sqlite = openDatabase(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  initTables(sqlite);
  sqliteInstance = sqlite;
  dbInstance = drizzle(sqlite, { schema });
  // Lazy backfills â€” evita dependÃªncia circular com @/platform/db no bootstrap (tsx/seed).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { backfillClientBusinessIds } = require("@/lib/client-business-scope") as {
    backfillClientBusinessIds: () => void;
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { backfillIntelligenceFromDiaries } = require("@/platform/db/sqlite/backfill-intelligence") as {
    backfillIntelligenceFromDiaries: () => void;
  };
  backfillClientBusinessIds();
  backfillIntelligenceFromDiaries();
  return dbInstance;
}

export function getSqlite(): Database.Database {
  getSqliteDb();
  if (!sqliteInstance) {
    throw new Error("SQLite instance not initialized");
  }
  return sqliteInstance;
}

export function runSqliteTransaction<T>(fn: () => T): T {
  const sqlite = getSqlite();
  return sqlite.transaction(fn)();
}

export { schema as sqliteSchema };
