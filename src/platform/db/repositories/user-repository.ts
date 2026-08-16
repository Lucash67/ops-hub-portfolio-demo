import { eq } from "drizzle-orm";
import { getPostgresDb, getSqliteDb, isPostgres } from "@/platform/db";
import { queryOne, queryRun, toIsoTimestamp } from "@/platform/db/query";
import { users as sqliteUsers } from "@/lib/db/schema";
import { users as pgUsers } from "@/lib/db/postgres/schema";
import { generateId } from "@/shared/ids/generate-id";

export interface AuthUserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

function mapPgUser(row: typeof pgUsers.$inferSelect): AuthUserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSqliteUser(row: typeof sqliteUsers.$inferSelect): AuthUserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export async function findUserByEmail(email: string): Promise<AuthUserRecord | undefined> {
  const normalized = email.trim().toLowerCase();

  if (isPostgres()) {
    const db = await getPostgresDb();
    const row = await queryOne(db.select().from(pgUsers).where(eq(pgUsers.email, normalized)));
    return row ? mapPgUser(row) : undefined;
  }

  const db = getSqliteDb();
  const row = await queryOne(db.select().from(sqliteUsers).where(eq(sqliteUsers.email, normalized)));
  return row ? mapSqliteUser(row) : undefined;
}

export async function findUserById(id: string): Promise<AuthUserRecord | undefined> {
  if (isPostgres()) {
    const db = await getPostgresDb();
    const row = await queryOne(db.select().from(pgUsers).where(eq(pgUsers.id, id)));
    return row ? mapPgUser(row) : undefined;
  }

  const db = getSqliteDb();
  const row = await queryOne(db.select().from(sqliteUsers).where(eq(sqliteUsers.id, id)));
  return row ? mapSqliteUser(row) : undefined;
}

export async function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<AuthUserRecord> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const now = new Date();

  if (isPostgres()) {
    const db = await getPostgresDb();
    const rows = await queryOne(
      db
        .insert(pgUsers)
        .values({
          email,
          name,
          passwordHash: input.passwordHash,
          createdAt: now,
          updatedAt: now,
        })
        .returning(),
    );
    if (!rows) throw new Error("Failed to create user");
    return mapPgUser(rows);
  }

  const id = generateId();
  const db = getSqliteDb();
  await queryRun(
    db.insert(sqliteUsers).values({
      id,
      email,
      name,
      passwordHash: input.passwordHash,
      createdAt: toIsoTimestamp(now),
      updatedAt: toIsoTimestamp(now),
    }),
  );

  const created = await findUserById(id);
  if (!created) throw new Error("Failed to create user");
  return created;
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  const now = new Date();

  if (isPostgres()) {
    const db = await getPostgresDb();
    await queryRun(
      db.update(pgUsers).set({ passwordHash, updatedAt: now }).where(eq(pgUsers.id, userId)),
    );
    return;
  }

  const db = getSqliteDb();
  await queryRun(
    db
      .update(sqliteUsers)
      .set({ passwordHash, updatedAt: toIsoTimestamp(now) })
      .where(eq(sqliteUsers.id, userId)),
  );
}

export async function updateUserProfile(
  userId: string,
  input: { name?: string; passwordHash?: string },
): Promise<void> {
  const now = new Date();
  const patch: Record<string, unknown> = { updatedAt: now };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.passwordHash !== undefined) patch.passwordHash = input.passwordHash;

  if (isPostgres()) {
    const db = await getPostgresDb();
    await queryRun(db.update(pgUsers).set(patch).where(eq(pgUsers.id, userId)));
    return;
  }

  const db = getSqliteDb();
  const sqlitePatch: Record<string, string> = { updatedAt: toIsoTimestamp(now) };
  if (input.name !== undefined) sqlitePatch.name = input.name.trim();
  if (input.passwordHash !== undefined) sqlitePatch.passwordHash = input.passwordHash;
  await queryRun(db.update(sqliteUsers).set(sqlitePatch).where(eq(sqliteUsers.id, userId)));
}

export async function upsertUserByEmail(input: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<AuthUserRecord> {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    await updateUserProfile(existing.id, { name: input.name, passwordHash: input.passwordHash });
    const updated = await findUserById(existing.id);
    if (!updated) throw new Error("Failed to update user");
    return updated;
  }
  return createUser(input);
}
