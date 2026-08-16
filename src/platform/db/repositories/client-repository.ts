import { eq } from "drizzle-orm";
import { getPostgresDb, getSqliteDb, isPostgres } from "@/platform/db";
import { mapClientRow } from "@/platform/db/mappers";
import { queryAll, queryOne, queryRun, toIsoTimestamp } from "@/platform/db/query";
import { toDbBusinessId } from "@/platform/db/business-id";
import { clients as sqliteClients } from "@/lib/db/schema";
import { clients as pgClients } from "@/lib/db/postgres/schema";
import { generateId } from "@/shared/ids/generate-id";
import type { LegacyClient } from "@/lib/db/types";

export async function listClientsRaw(): Promise<LegacyClient[]> {
  if (isPostgres()) {
    const db = await getPostgresDb();
    const rows = await queryAll(db.select().from(pgClients));
    return rows.map(mapClientRow);
  }
  const db = getSqliteDb();
  const rows = await queryAll(db.select().from(sqliteClients));
  return rows.map(mapClientRow);
}

export async function getClientById(clientId: string): Promise<LegacyClient | undefined> {
  if (isPostgres()) {
    const db = await getPostgresDb();
    const row = await queryOne(db.select().from(pgClients).where(eq(pgClients.id, clientId)));
    return row ? mapClientRow(row) : undefined;
  }
  const db = getSqliteDb();
  const row = await queryOne(db.select().from(sqliteClients).where(eq(sqliteClients.id, clientId)));
  return row ? mapClientRow(row) : undefined;
}

export async function createClient(input: {
  businessId?: string;
  name: string;
  sector?: string | null;
  company?: string | null;
  phone?: string | null;
  notes?: string | null;
}): Promise<string> {
  const id = generateId();
  const now = new Date();

  if (isPostgres()) {
    const db = await getPostgresDb();
    await queryRun(
      db.insert(pgClients).values({
        id,
        name: input.name,
        sector: input.sector ?? null,
        company: input.company ?? null,
        phone: input.phone ?? null,
        notes: input.notes ?? null,
        registeredBusinessId: input.businessId ? toDbBusinessId(input.businessId) : null,
        createdAt: now,
        updatedAt: now,
      }),
    );
    return id;
  }

  const db = getSqliteDb();
  await queryRun(
    db.insert(sqliteClients).values({
      id,
      businessId: input.businessId ?? "salgados",
      name: input.name,
      sector: input.sector ?? null,
      company: input.company ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      createdAt: toIsoTimestamp(now),
      updatedAt: toIsoTimestamp(now),
    }),
  );
  return id;
}

export async function updateClient(input: {
  id: string;
  name: string;
  sector?: string | null;
  company?: string | null;
  phone?: string | null;
  notes?: string | null;
}): Promise<void> {
  const now = new Date();

  if (isPostgres()) {
    const db = await getPostgresDb();
    await queryRun(
      db
        .update(pgClients)
        .set({
          name: input.name,
          sector: input.sector ?? null,
          company: input.company ?? null,
          phone: input.phone ?? null,
          notes: input.notes ?? null,
          updatedAt: now,
        })
        .where(eq(pgClients.id, input.id)),
    );
    return;
  }

  const db = getSqliteDb();
  await queryRun(
    db
      .update(sqliteClients)
      .set({
        name: input.name,
        sector: input.sector ?? null,
        company: input.company ?? null,
        phone: input.phone ?? null,
        notes: input.notes ?? null,
        updatedAt: toIsoTimestamp(now),
      })
      .where(eq(sqliteClients.id, input.id)),
  );
}
