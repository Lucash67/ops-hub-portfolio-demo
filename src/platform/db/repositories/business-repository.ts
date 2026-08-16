import { and, eq } from "drizzle-orm";
import { getPostgresDb, getSqliteDb, isPostgres } from "@/platform/db";
import { mapBusinessRowToLegacy } from "@/platform/db/business-id";
import { queryAll, queryOne, queryRun, toIsoTimestamp } from "@/platform/db/query";
import { businessUnits } from "@/lib/db/schema";
import { businesses as pgBusinesses } from "@/lib/db/postgres/schema";
import { slugifyBusinessName } from "@/lib/slugify";
import { generateId } from "@/shared/ids/generate-id";
import type { BusinessUnit } from "@/lib/business-units";

export interface OwnedBusiness extends BusinessUnit {
  /** Postgres UUID or SQLite primary key used in FK columns. */
  dbId: string;
}

export async function listBusinesses(userId: string): Promise<OwnedBusiness[]> {
  if (isPostgres()) {
    const db = await getPostgresDb();
    const rows = await queryAll(
      db.select().from(pgBusinesses).where(eq(pgBusinesses.ownerId, userId)),
    );
    return rows.map((row) => ({
      ...mapBusinessRowToLegacy(row),
      dbId: row.id,
    }));
  }

  const db = getSqliteDb();
  const rows = await queryAll(
    db.select().from(businessUnits).where(eq(businessUnits.ownerId, userId)),
  );
  return rows.map((row) => ({
    ...mapBusinessRowToLegacy({
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
    }),
    dbId: row.id,
  }));
}

async function ensureUniqueSlug(userId: string, baseSlug: string): Promise<string> {
  let candidate = baseSlug || "operacao";
  let attempt = 1;

  while (true) {
    const existing = (await listBusinesses(userId)).some((b) => b.slug === candidate);
    if (!existing) return candidate;
    attempt += 1;
    candidate = `${baseSlug || "operacao"}-${attempt}`;
  }
}

export async function createBusiness(input: {
  ownerId: string;
  name: string;
}): Promise<OwnedBusiness> {
  const name = input.name.trim();
  const baseSlug = slugifyBusinessName(name);
  const slug = await ensureUniqueSlug(input.ownerId, baseSlug);
  const now = new Date();

  if (isPostgres()) {
    const db = await getPostgresDb();
    const id = generateId();
    await queryRun(
      db.insert(pgBusinesses).values({
        id,
        ownerId: input.ownerId,
        slug,
        name,
        status: "active",
        createdAt: now,
        updatedAt: now,
      }),
    );
    const row = await queryOne(
      db
        .select()
        .from(pgBusinesses)
        .where(and(eq(pgBusinesses.ownerId, input.ownerId), eq(pgBusinesses.slug, slug))),
    );
    if (!row) throw new Error("Falha ao criar operação.");
    return { ...mapBusinessRowToLegacy(row), dbId: row.id };
  }

  const db = getSqliteDb();
  const id = slug;
  const iso = toIsoTimestamp(now);
  await queryRun(
    db.insert(businessUnits).values({
      id,
      ownerId: input.ownerId,
      name,
      slug,
      status: "active",
      createdAt: iso,
      updatedAt: iso,
    }),
  );
  return {
    id,
    name,
    slug,
    status: "active",
    dbId: id,
  };
}
