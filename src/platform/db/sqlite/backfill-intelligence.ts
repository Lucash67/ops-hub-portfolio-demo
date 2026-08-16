import { eq } from "drizzle-orm";
import { getSqliteDb } from "@/platform/db/sqlite/client";
import {
  ENTITY_TYPE,
  operationalDiaryEntrySchema,
  parseDiaryEntityId,
} from "@/lib/diary/types";
import { notes, settings } from "@/lib/db/schema";

const BACKFILL_KEY = "operational_intelligence_backfill_v1";

/**
 * Legacy SQLite-only backfill — executado na init do SQLite, não no runtime PostgreSQL.
 */
export function backfillIntelligenceFromDiaries(): void {
  const db = getSqliteDb();
  const done = db.select().from(settings).where(eq(settings.key, BACKFILL_KEY)).get();
  if (done) return;

  const rows = db.select().from(notes).where(eq(notes.entityType, ENTITY_TYPE)).all();
  for (const row of rows) {
    const meta = parseDiaryEntityId(row.entityId);
    if (!meta) continue;
    try {
      operationalDiaryEntrySchema.parse(JSON.parse(row.content));
      // Relational sync no SQLite permanece legado; ETL copiará para PostgreSQL.
    } catch {
      /* skip corrupt */
    }
  }

  const now = new Date().toISOString();
  db.insert(settings)
    .values({ key: BACKFILL_KEY, value: "done", updatedAt: now })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: "done", updatedAt: now },
    })
    .run();
}
