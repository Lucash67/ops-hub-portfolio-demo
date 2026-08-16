import { and, desc, eq } from "drizzle-orm";
import { getPostgresDb, getSqliteDb, isPostgres } from "@/platform/db";
import { stickyNotes as pgStickyNotes } from "@/lib/db/postgres/schema";
import { stickyNotes as sqliteStickyNotes } from "@/lib/db/schema";
import { queryAll, queryOne, queryRun, toDateString, toIsoTimestamp } from "@/platform/db/query";
import { generateId } from "@/shared/ids/generate-id";
import type { StickyNote, StickyNoteColor } from "@/lib/sticky-notes/types";

export interface StickyNoteWriteInput {
  id?: string;
  title?: string;
  body?: string;
  color?: StickyNoteColor;
  noteDate?: string | null;
  pinned?: boolean;
  archived?: boolean;
  sortOrder?: number;
  clientUpdatedAt: string;
  businessId?: string | null;
}

function mapPgRow(row: typeof pgStickyNotes.$inferSelect): StickyNote {
  return {
    id: row.id,
    ownerId: row.ownerId,
    businessId: row.businessId,
    title: row.title ?? "",
    body: row.body ?? "",
    color: (row.color as StickyNoteColor) || "default",
    noteDate: row.noteDate ? toDateString(row.noteDate) : null,
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    sortOrder: row.sortOrder ?? 0,
    clientUpdatedAt: toIsoTimestamp(row.clientUpdatedAt),
    createdAt: toIsoTimestamp(row.createdAt),
    updatedAt: toIsoTimestamp(row.updatedAt),
  };
}

function mapSqliteRow(row: typeof sqliteStickyNotes.$inferSelect): StickyNote {
  return {
    id: row.id,
    ownerId: row.ownerId,
    businessId: row.businessId,
    title: row.title ?? "",
    body: row.body ?? "",
    color: (row.color as StickyNoteColor) || "default",
    noteDate: row.noteDate ?? null,
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    sortOrder: row.sortOrder ?? 0,
    clientUpdatedAt: row.clientUpdatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listStickyNotes(
  ownerId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<StickyNote[]> {
  if (isPostgres()) {
    const db = await getPostgresDb();
    const rows = await queryAll(
      db
        .select()
        .from(pgStickyNotes)
        .where(
          includeArchived
            ? eq(pgStickyNotes.ownerId, ownerId)
            : and(eq(pgStickyNotes.ownerId, ownerId), eq(pgStickyNotes.archived, false)),
        )
        .orderBy(desc(pgStickyNotes.pinned), desc(pgStickyNotes.clientUpdatedAt)),
    );
    return rows.map(mapPgRow);
  }

  const db = getSqliteDb();
  const rows = includeArchived
    ? db
        .select()
        .from(sqliteStickyNotes)
        .where(eq(sqliteStickyNotes.ownerId, ownerId))
        .orderBy(desc(sqliteStickyNotes.pinned), desc(sqliteStickyNotes.clientUpdatedAt))
        .all()
    : db
        .select()
        .from(sqliteStickyNotes)
        .where(
          and(eq(sqliteStickyNotes.ownerId, ownerId), eq(sqliteStickyNotes.archived, false)),
        )
        .orderBy(desc(sqliteStickyNotes.pinned), desc(sqliteStickyNotes.clientUpdatedAt))
        .all();
  return rows.map(mapSqliteRow);
}

export async function getStickyNoteById(
  ownerId: string,
  id: string,
): Promise<StickyNote | null> {
  if (isPostgres()) {
    const db = await getPostgresDb();
    const row = await queryOne(
      db
        .select()
        .from(pgStickyNotes)
        .where(and(eq(pgStickyNotes.id, id), eq(pgStickyNotes.ownerId, ownerId)))
        .limit(1),
    );
    return row ? mapPgRow(row) : null;
  }

  const db = getSqliteDb();
  const row = db
    .select()
    .from(sqliteStickyNotes)
    .where(and(eq(sqliteStickyNotes.id, id), eq(sqliteStickyNotes.ownerId, ownerId)))
    .get();
  return row ? mapSqliteRow(row) : null;
}

export async function upsertStickyNote(
  ownerId: string,
  input: StickyNoteWriteInput,
): Promise<StickyNote> {
  const now = new Date().toISOString();
  const id = input.id ?? generateId();
  const existing = input.id ? await getStickyNoteById(ownerId, input.id) : null;

  if (
    existing &&
    input.clientUpdatedAt &&
    existing.clientUpdatedAt > input.clientUpdatedAt
  ) {
    return existing;
  }

  const title = input.title ?? existing?.title ?? "";
  const body = input.body ?? existing?.body ?? "";
  const color = input.color ?? existing?.color ?? "default";
  const noteDate =
    input.noteDate !== undefined ? input.noteDate : (existing?.noteDate ?? null);
  const pinned = input.pinned ?? existing?.pinned ?? false;
  const archived = input.archived ?? existing?.archived ?? false;
  const sortOrder = input.sortOrder ?? existing?.sortOrder ?? 0;
  const clientUpdatedAt = input.clientUpdatedAt || now;

  if (isPostgres()) {
    const db = await getPostgresDb();
    if (existing) {
      await queryRun(
        db
          .update(pgStickyNotes)
          .set({
            title,
            body,
            color,
            noteDate,
            pinned,
            archived,
            sortOrder,
            clientUpdatedAt: new Date(clientUpdatedAt),
            updatedAt: new Date(),
          })
          .where(and(eq(pgStickyNotes.id, id), eq(pgStickyNotes.ownerId, ownerId))),
      );
    } else {
      await queryRun(
        db.insert(pgStickyNotes).values({
          id,
          ownerId,
          title,
          body,
          color,
          noteDate,
          pinned,
          archived,
          sortOrder,
          clientUpdatedAt: new Date(clientUpdatedAt),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
    }
    const saved = await getStickyNoteById(ownerId, id);
    if (!saved) throw new Error("Falha ao salvar nota.");
    return saved;
  }

  const db = getSqliteDb();
  if (existing) {
    db.update(sqliteStickyNotes)
      .set({
        title,
        body,
        color,
        noteDate,
        pinned,
        archived,
        sortOrder,
        clientUpdatedAt,
        updatedAt: now,
      })
      .where(and(eq(sqliteStickyNotes.id, id), eq(sqliteStickyNotes.ownerId, ownerId)))
      .run();
  } else {
    db.insert(sqliteStickyNotes)
      .values({
        id,
        ownerId,
        businessId: null,
        title,
        body,
        color,
        noteDate,
        pinned,
        archived,
        sortOrder,
        clientUpdatedAt,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  const saved = await getStickyNoteById(ownerId, id);
  if (!saved) throw new Error("Falha ao salvar nota.");
  return saved;
}

export async function deleteStickyNote(ownerId: string, id: string): Promise<boolean> {
  const existing = await getStickyNoteById(ownerId, id);
  if (!existing) return false;

  if (isPostgres()) {
    const db = await getPostgresDb();
    await queryRun(
      db
        .delete(pgStickyNotes)
        .where(and(eq(pgStickyNotes.id, id), eq(pgStickyNotes.ownerId, ownerId))),
    );
    return true;
  }

  getSqliteDb()
    .delete(sqliteStickyNotes)
    .where(and(eq(sqliteStickyNotes.id, id), eq(sqliteStickyNotes.ownerId, ownerId)))
    .run();
  return true;
}
