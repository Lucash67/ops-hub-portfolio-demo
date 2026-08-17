/**
 * Garante dados fictícios da demo (SQLite) — usado no seed CLI e no boot Vercel (/tmp).
 * Sem Postgres / sem Supabase.
 */
import { addDays, format, getDay, subDays } from "date-fns";

export const DEMO_EMAIL = "demo@portfolio.com";
export const DEMO_PASSWORD = "Demo123!";
export const DEMO_NAME = "Demo Portfolio";
/** Same id on every Vercel instance so JWT + /tmp SQLite stay aligned. */
export const DEMO_USER_ID = "demo-portfolio-user";

const CLIENTS = [
  { name: "Mariana Oliveira", sector: "Escritório", company: "NovaTech Solutions" },
  { name: "Gabriel Martins", sector: "Operações", company: "Atlas Digital" },
  { name: "Rafael Almeida", sector: "Comercial", company: "Horizonte Group" },
  { name: "Beatriz Costa", sector: "Financeiro", company: "Lumina Sistemas" },
  { name: "João Victor Santos", sector: "TI", company: "Prime Business" },
  { name: "Camila Ferreira", sector: "RH", company: "NovaTech Solutions" },
  { name: "Lucas Mendes", sector: "Marketing", company: "Atlas Digital" },
  { name: "Ana Paula Rocha", sector: "Diretoria", company: "Horizonte Group" },
];

const SALTY_PRODUCTS = [
  { name: "Coxinha", category: "Salgado", price: 5, cost: 2.2 },
  { name: "Pastel de Carne", category: "Salgado", price: 6, cost: 2.6 },
  { name: "Kibe", category: "Salgado", price: 5, cost: 2.3 },
  { name: "Empada de Frango", category: "Salgado", price: 5.5, cost: 2.4 },
  { name: "Sabor não identificado", category: "Salgado", price: 5, cost: 2.2 },
];

const CANDY_PRODUCTS = [
  { name: "Brigadeiro tradicional", category: "Doce", price: 4, cost: 1.5 },
  { name: "Brigadeiro belga", category: "Doce", price: 5, cost: 2 },
  { name: "Beijinho", category: "Doce", price: 4, cost: 1.4 },
];

function weekdayDates(daysBack: number): string[] {
  const today = new Date();
  const out: string[] = [];
  for (let i = daysBack; i >= 0; i--) {
    const d = subDays(today, i);
    const dow = getDay(d);
    if (dow === 0 || dow === 6) continue;
    out.push(format(d, "yyyy-MM-dd"));
  }
  return out;
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

let seedPromise: Promise<void> | null = null;

/** Idempotente: se o usuário demo já existe, não reseeda. */
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

    const { findUserByEmail, createUser } = await import(
      "@/platform/db/repositories/user-repository"
    );
    const existing = await findUserByEmail(DEMO_EMAIL);

    const { hashPassword } = await import("@/lib/auth/password");
    const { createBusiness, listBusinesses } = await import(
      "@/platform/db/repositories/business-repository"
    );
    const { createProduct, listProducts } = await import(
      "@/platform/db/repositories/product-repository"
    );
    const { createClient } = await import("@/platform/db/repositories/client-repository");
    const { executeSaleRecord } = await import("@/platform/db/repositories/sale-repository");

    let user = existing;
    if (!user) {
      user = await createUser({
        id: DEMO_USER_ID,
        email: DEMO_EMAIL,
        name: DEMO_NAME,
        passwordHash: await hashPassword(DEMO_PASSWORD),
      });
    } else if (!options?.force) {
      const businesses = await listBusinesses(user.id);
      if (businesses.length > 0) {
        const products = await listProducts(businesses[0]!.id);
        if (products.length > 0) return;
      }
    }

    getSqlite()
      .prepare("UPDATE business_units SET owner_id = ? WHERE owner_id IS NULL OR owner_id = ''")
      .run(user.id);

    let businesses = await listBusinesses(user.id);
    if (businesses.length === 0) {
      await createBusiness({ ownerId: user.id, name: "Salgados" });
      await createBusiness({ ownerId: user.id, name: "Brigadeiros" });
      businesses = await listBusinesses(user.id);
    }

    const salty = businesses.find(
      (b) => b.slug === "salgados" || b.name.toLowerCase().includes("salg"),
    );
    const candy = businesses.find(
      (b) => b.slug === "brigadeiros" || b.name.toLowerCase().includes("brig"),
    );
    if (!salty || !candy) throw new Error("Demo businesses missing");

    // Evita duplicar produtos se cold start parcial
    const existingProducts = await listProducts(salty.id);
    if (existingProducts.length > 0 && !options?.force) return;

    const saltyProductIds: string[] = [];
    for (const p of SALTY_PRODUCTS) {
      saltyProductIds.push(
        await createProduct({
          businessId: salty.id,
          name: p.name,
          category: p.category,
          price: p.price,
          cost: p.cost,
          stockQuantity: 80,
          minStock: 10,
        }),
      );
    }

    const candyProductIds: string[] = [];
    for (const p of CANDY_PRODUCTS) {
      candyProductIds.push(
        await createProduct({
          businessId: candy.id,
          name: p.name,
          category: p.category,
          price: p.price,
          cost: p.cost,
          stockQuantity: 60,
          minStock: 8,
        }),
      );
    }

    const clientIds: string[] = [];
    for (const c of CLIENTS) {
      clientIds.push(
        await createClient({
          businessId: salty.id,
          name: c.name,
          sector: c.sector,
          company: c.company,
          phone: null,
          notes: "Cliente fictício da demo de portfólio",
        }),
      );
    }

    const dates = weekdayDates(55);
    const methods: Array<"pix" | "card" | "cash"> = ["pix", "pix", "pix", "cash", "card"];

    for (let di = 0; di < dates.length; di++) {
      const date = dates[di]!;
      const daySales = 4 + (di % 5);
      for (let s = 0; s < daySales; s++) {
        await executeSaleRecord({
          productId: pick(saltyProductIds, di + s),
          quantity: 1 + ((di + s) % 3),
          clientId: pick(clientIds, di + s * 2),
          paymentMethod: pick(methods, di + s),
          date,
          time: `${9 + (s % 4)}:${String((s * 7) % 60).padStart(2, "0")}`,
          department: pick(["Escritório Central", "Torre Norte", "Praça de Alimentação"], di + s),
          notes: s % 7 === 0 ? "Venda demo" : null,
        });
      }
      if (di % 2 === 0) {
        await executeSaleRecord({
          productId: pick(candyProductIds, di),
          quantity: 2 + (di % 3),
          clientId: pick(clientIds, di + 1),
          paymentMethod: "pix",
          date,
          time: "14:30",
          department: "Loja",
        });
      }
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const dow = getDay(new Date());
    if (dow !== 0 && dow !== 6) {
      await executeSaleRecord({
        productId: saltyProductIds[0]!,
        quantity: 3,
        clientId: clientIds[0]!,
        paymentMethod: "pix",
        date: today,
        time: format(new Date(), "HH:mm"),
        department: "Escritório Central",
        notes: "Venda demo do dia",
      });
    } else {
      const last = dates.at(-1) ?? format(addDays(new Date(), -1), "yyyy-MM-dd");
      await executeSaleRecord({
        productId: saltyProductIds[0]!,
        quantity: 2,
        clientId: clientIds[1]!,
        paymentMethod: "pix",
        date: last,
        time: "11:00",
      });
    }
  })().catch((error) => {
    seedPromise = null;
    throw error;
  });

  return seedPromise;
}
