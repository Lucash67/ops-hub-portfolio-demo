import { format, subDays } from "date-fns";
import {
  ALL_BUSINESSES_ID,
  BUSINESS_GOALS_BLOCKED_MESSAGE,
  isAllBusinesses,
} from "@/lib/business-units";
import {
  findGoalByType,
  insertGoal,
  listGoalsByType,
  updateGoalById,
} from "@/platform/db/repositories/goal-repository";

export type GoalType = "daily" | "weekly" | "monthly" | "yearly";

function periodBounds(type: GoalType): { periodStart: string; periodEnd: string } {
  const today = format(new Date(), "yyyy-MM-dd");
  const now = new Date();

  switch (type) {
    case "daily":
      return { periodStart: today, periodEnd: today };
    case "weekly": {
      const day = now.getDay();
      const weekStart = format(subDays(now, day === 0 ? 6 : day - 1), "yyyy-MM-dd");
      return { periodStart: weekStart, periodEnd: today };
    }
    case "monthly":
      return {
        periodStart: format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd"),
        periodEnd: today,
      };
    case "yearly":
      return {
        periodStart: format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"),
        periodEnd: today,
      };
  }
}

export async function initializeGoalsIfEmpty(businessId: string): Promise<void> {
  if (isAllBusinesses(businessId)) {
    throw new Error(BUSINESS_GOALS_BLOCKED_MESSAGE);
  }

  const existing = await findGoalByType(businessId, "daily");
  if (existing) return;

  const types: GoalType[] = ["daily", "weekly", "monthly", "yearly"];
  for (const type of types) {
    const { periodStart, periodEnd } = periodBounds(type);
    await insertGoal({
      businessId,
      type,
      targetAmount: 0,
      targetUnits: null,
      periodStart,
      periodEnd,
    });
  }
}

export interface GoalTargetInput {
  amount: number;
  units?: number | null;
  /** Período explícito — usado quando a meta é de um período futuro (ex.: mês seguinte). */
  periodStart?: string;
  periodEnd?: string;
}

function normalizeTarget(value: number | GoalTargetInput): GoalTargetInput {
  return typeof value === "number" ? { amount: value } : value;
}

export async function updateGoalTargets(
  targets: Partial<Record<GoalType, number | GoalTargetInput>>,
  businessId: string,
): Promise<void> {
  if (isAllBusinesses(businessId)) {
    throw new Error(BUSINESS_GOALS_BLOCKED_MESSAGE);
  }

  await initializeGoalsIfEmpty(businessId);

  for (const [type, raw] of Object.entries(targets) as [
    GoalType,
    number | GoalTargetInput,
  ][]) {
    if (raw === undefined || raw === null) continue;
    const target = normalizeTarget(raw);
    if (Number.isNaN(target.amount)) continue;

    const bounds = periodBounds(type);
    const periodStart = target.periodStart ?? bounds.periodStart;
    const periodEnd = target.periodEnd ?? bounds.periodEnd;
    const existing = await findGoalByType(businessId, type);
    const targetUnits =
      target.units === undefined ? (existing?.targetUnits ?? null) : target.units;

    if (existing) {
      await updateGoalById(existing.id, {
        targetAmount: target.amount,
        targetUnits,
        periodStart,
        periodEnd,
      });
    } else {
      await insertGoal({
        businessId,
        type,
        targetAmount: target.amount,
        targetUnits,
        periodStart,
        periodEnd,
      });
    }
  }
}

/** Zera amount/units para a meta voltar a usar a sugestão inteligente. */
export async function clearGoalsToSmart(
  businessId: string,
  types: GoalType[] = ["daily", "weekly", "monthly"],
): Promise<void> {
  if (isAllBusinesses(businessId)) {
    throw new Error(BUSINESS_GOALS_BLOCKED_MESSAGE);
  }
  await initializeGoalsIfEmpty(businessId);
  for (const type of types) {
    const existing = await findGoalByType(businessId, type);
    if (!existing) continue;
    const bounds = periodBounds(type);
    await updateGoalById(existing.id, {
      targetAmount: 0,
      targetUnits: null,
      periodStart: bounds.periodStart,
      periodEnd: bounds.periodEnd,
    });
  }
}

export async function getDailyGoalTarget(businessId: string = ALL_BUSINESSES_ID): Promise<number> {
  const dailyGoals = await listGoalsByType("daily");
  if (isAllBusinesses(businessId)) {
    return dailyGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  }
  return dailyGoals.find((g) => g.businessId === businessId)?.targetAmount ?? 0;
}

export async function getDailyGoalUnitsTarget(
  businessId: string = ALL_BUSINESSES_ID,
): Promise<number> {
  const dailyGoals = await listGoalsByType("daily");
  if (isAllBusinesses(businessId)) {
    return dailyGoals.reduce((sum, g) => sum + (g.targetUnits ?? 0), 0);
  }
  return dailyGoals.find((g) => g.businessId === businessId)?.targetUnits ?? 0;
}
