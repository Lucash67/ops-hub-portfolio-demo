import { and, desc, eq } from "drizzle-orm";
import { getPostgresDb, getSqliteDb, isPostgres } from "@/platform/db";
import { mapGoalRow, resolveBusinessScopeId } from "@/platform/db/mappers";
import { queryAll, queryOne, queryRun, toDateString, toIsoTimestamp } from "@/platform/db/query";
import { toDbBusinessId } from "@/platform/db/business-id";
import { goals as sqliteGoals } from "@/lib/db/schema";
import { goals as pgGoals } from "@/lib/db/postgres/schema";
import { isAllBusinesses } from "@/lib/business-units";
import { generateId } from "@/shared/ids/generate-id";
import type { LegacyGoal } from "@/lib/db/types";
import type { GoalType } from "@/lib/goals-service";

export async function listGoals(businessId?: string): Promise<LegacyGoal[]> {
  if (isPostgres()) {
    const db = await getPostgresDb();
    const rows = businessId && !isAllBusinesses(businessId)
      ? await queryAll(
          db
            .select()
            .from(pgGoals)
            .where(eq(pgGoals.businessId, resolveBusinessScopeId(businessId))),
        )
      : await queryAll(db.select().from(pgGoals));
    return rows.map(mapGoalRow);
  }

  const db = getSqliteDb();
  const rows = await queryAll(db.select().from(sqliteGoals));
  if (businessId && !isAllBusinesses(businessId)) {
    return rows.filter((g) => g.businessId === businessId).map(mapGoalRow);
  }
  return rows.map(mapGoalRow);
}

export async function getGoalById(goalId: string): Promise<LegacyGoal | undefined> {
  if (isPostgres()) {
    const db = await getPostgresDb();
    const row = await queryOne(db.select().from(pgGoals).where(eq(pgGoals.id, goalId)));
    return row ? mapGoalRow(row) : undefined;
  }
  const db = getSqliteDb();
  const row = await queryOne(db.select().from(sqliteGoals).where(eq(sqliteGoals.id, goalId)));
  return row ? mapGoalRow(row) : undefined;
}

export async function findGoalByType(
  businessId: string,
  goalType: GoalType,
): Promise<LegacyGoal | undefined> {
  const goals = await listGoals(businessId);
  return goals.find((g) => g.type === goalType && g.businessId === businessId);
}

export async function insertGoal(input: {
  businessId: string;
  type: GoalType;
  targetAmount: number;
  targetUnits?: number | null;
  periodStart: string;
  periodEnd: string;
}): Promise<string> {
  const id = generateId();
  const now = new Date();

  if (isPostgres()) {
    const db = await getPostgresDb();
    await queryRun(
      db.insert(pgGoals).values({
        id,
        businessId: toDbBusinessId(input.businessId),
        goalType: input.type,
        targetAmount: String(input.targetAmount),
        targetUnits: input.targetUnits ?? null,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        createdAt: now,
        updatedAt: now,
      }),
    );
    return id;
  }

  const db = getSqliteDb();
  await queryRun(
    db.insert(sqliteGoals).values({
      id,
      businessId: input.businessId,
      type: input.type,
      targetAmount: input.targetAmount,
      targetUnits: input.targetUnits ?? null,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      createdAt: toIsoTimestamp(now),
      updatedAt: toIsoTimestamp(now),
    }),
  );
  return id;
}

export async function updateGoalById(
  goalId: string,
  input: {
    targetAmount: number;
    targetUnits?: number | null;
    periodStart: string;
    periodEnd: string;
  },
): Promise<void> {
  const now = new Date();

  if (isPostgres()) {
    const db = await getPostgresDb();
    await queryRun(
      db
        .update(pgGoals)
        .set({
          targetAmount: String(input.targetAmount),
          targetUnits: input.targetUnits ?? null,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          updatedAt: now,
        })
        .where(eq(pgGoals.id, goalId)),
    );
    return;
  }

  const db = getSqliteDb();
  await queryRun(
    db
      .update(sqliteGoals)
      .set({
        targetAmount: input.targetAmount,
        targetUnits: input.targetUnits ?? null,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        updatedAt: toIsoTimestamp(now),
      })
      .where(eq(sqliteGoals.id, goalId)),
  );
}

export async function listGoalsByType(goalType: GoalType): Promise<LegacyGoal[]> {
  if (isPostgres()) {
    const db = await getPostgresDb();
    const rows = await queryAll(
      db.select().from(pgGoals).where(eq(pgGoals.goalType, goalType)).orderBy(desc(pgGoals.periodStart)),
    );
    return rows.map(mapGoalRow);
  }
  const db = getSqliteDb();
  const rows = await queryAll(
    db.select().from(sqliteGoals).where(eq(sqliteGoals.type, goalType)),
  );
  return rows.map(mapGoalRow);
}

export { toDateString };
