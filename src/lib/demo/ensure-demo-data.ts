/**
 * Bootstrap da demo de portfólio (SQLite).
 * Conta vazia: só o usuário de login — sem operações, vendas ou cadastros.
 * No produto real cada pessoa cria as próprias operações.
 */
export const DEMO_EMAIL = "demo@portfolio.com";
export const DEMO_PASSWORD = "Demo123!";
export const DEMO_NAME = "Demo Portfolio";
/** Same id on every Vercel instance so JWT + /tmp SQLite stay aligned. */
export const DEMO_USER_ID = "demo-portfolio-user";

/** Bump to force wipe of legacy Salty/Candy seeds on existing /tmp DBs. */
const DEMO_EMPTY_SEED_VERSION = 2;

let seedPromise: Promise<void> | null = null;

function clearOperationalTables(sqlite: {
  exec: (sql: string) => unknown;
  prepare: (sql: string) => { run: (...args: unknown[]) => unknown; get: (...args: unknown[]) => unknown };
}) {
  // Ordem segura: filhos antes de pais. DB da demo é descartável.
  const statements = [
    "DELETE FROM sale_items",
    "DELETE FROM sales",
    "DELETE FROM payments",
    "DELETE FROM stock_movements",
    "DELETE FROM sticky_notes",
    "DELETE FROM notes",
    "DELETE FROM daily_purchase_items",
    "DELETE FROM daily_purchases",
    "DELETE FROM operational_losses",
    "DELETE FROM operational_actions",
    "DELETE FROM product_hypotheses",
    "DELETE FROM operational_lessons",
    "DELETE FROM investments",
    "DELETE FROM cash_flow",
    "DELETE FROM goals",
    "DELETE FROM reports",
    "DELETE FROM clients",
    "DELETE FROM products",
    "DELETE FROM suppliers",
    "DELETE FROM effect_records",
    "DELETE FROM operation_interpretations",
    "DELETE FROM operation_payloads",
    "DELETE FROM operations",
    "DELETE FROM domain_events",
    "DELETE FROM business_units",
  ];

  for (const sql of statements) {
    try {
      sqlite.exec(sql);
    } catch {
      /* tabela pode não existir em schemas parciais */
    }
  }
}

/** Idempotente: garante login demo e conta operacional zerada. */
export async function ensureDemoData(options?: { force?: boolean }): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    process.env.DB_PROVIDER = "sqlite";
    const { DEMO_AUTH_SECRET } = await import("@/lib/auth/session");
    if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
      process.env.AUTH_SECRET = DEMO_AUTH_SECRET;
    }

    const { getSqliteDb, getSqlite } = await import("@/platform/db/sqlite/client");
    getSqliteDb();
    const sqlite = getSqlite();

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS demo_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const versionRow = sqlite
      .prepare("SELECT value FROM demo_meta WHERE key = ?")
      .get("empty_seed_version") as { value: string } | undefined;
    const currentVersion = Number(versionRow?.value ?? 0);
    const needsWipe = options?.force || currentVersion < DEMO_EMPTY_SEED_VERSION;

    const { findUserByEmail, createUser } = await import(
      "@/platform/db/repositories/user-repository"
    );
    const { hashPassword } = await import("@/lib/auth/password");

    let user = await findUserByEmail(DEMO_EMAIL);
    if (!user) {
      user = await createUser({
        id: DEMO_USER_ID,
        email: DEMO_EMAIL,
        name: DEMO_NAME,
        passwordHash: await hashPassword(DEMO_PASSWORD),
      });
    }

    if (needsWipe) {
      clearOperationalTables(sqlite);
      sqlite
        .prepare(
          `INSERT INTO demo_meta (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .run("empty_seed_version", String(DEMO_EMPTY_SEED_VERSION));
    }

    // Remove legado Salty/Candy mesmo se a versão já estiver atual (defesa extra).
    try {
      sqlite
        .prepare(
          "DELETE FROM business_units WHERE id IN ('salgados', 'brigadeiros') OR slug IN ('salgados', 'brigadeiros')",
        )
        .run();
    } catch {
      /* ignore */
    }

    void user;
  })().catch((error) => {
    seedPromise = null;
    throw error;
  });

  return seedPromise;
}
