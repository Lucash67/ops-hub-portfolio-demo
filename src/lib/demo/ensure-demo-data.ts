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

let seedPromise: Promise<void> | null = null;

function clearOperationalTables(sqlite: {
  exec: (sql: string) => unknown;
}) {
  // Sempre zera a demo pública. DB em /tmp é descartável.
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

/** Garante login demo e conta operacional sempre zerada (sem Salty/Candy). */
export async function ensureDemoData(_options?: { force?: boolean }): Promise<void> {
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

    // Remove seeds automáticos (Salty/Candy) que o init legado possa ter inserido.
    clearOperationalTables(sqlite);

    const { findUserByEmail, createUser } = await import(
      "@/platform/db/repositories/user-repository"
    );
    const { hashPassword } = await import("@/lib/auth/password");

    const existing = await findUserByEmail(DEMO_EMAIL);
    if (!existing) {
      await createUser({
        id: DEMO_USER_ID,
        email: DEMO_EMAIL,
        name: DEMO_NAME,
        passwordHash: await hashPassword(DEMO_PASSWORD),
      });
    }
  })().catch((error) => {
    seedPromise = null;
    throw error;
  });

  return seedPromise;
}
