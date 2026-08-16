import { differenceInCalendarDays, parseISO } from "date-fns";
import { computeGoalProgress, sumRevenue } from "../aggregates";
import { fetchScopedGoals } from "../queries";
import type { GoalKpis, KpiDataset } from "../types";

export async function computeGoalKpis(businessId: string, dataset: KpiDataset): Promise<GoalKpis> {
  const goals = await fetchScopedGoals(businessId);
  const today = new Date();

  const entries = goals.map((goal) => {
    const periodSales = dataset.sales.filter(
      (s) => s.date >= goal.periodStart && s.date <= goal.periodEnd,
    );
    const current = sumRevenue(periodSales);
    const percentAchieved = computeGoalProgress(current, goal.targetAmount);
    const remaining = Math.max(0, goal.targetAmount - current);

    const periodEnd = parseISO(goal.periodEnd);
    const daysRemaining = Math.max(0, differenceInCalendarDays(periodEnd, today) + 1);
    const requiredDailyPace = daysRemaining > 0 ? remaining / daysRemaining : remaining;

    return {
      type: goal.type,
      targetAmount: goal.targetAmount,
      current,
      percentAchieved,
      remaining,
      requiredDailyPace,
      daysRemaining,
    };
  });

  return { entries };
}

export function goalPercentAchieved(
  current: number,
  target: number,
): number {
  return computeGoalProgress(current, target);
}

export function goalRemaining(current: number, target: number): number {
  return Math.max(0, target - current);
}

export function goalRequiredPace(remaining: number, daysRemaining: number): number {
  return daysRemaining > 0 ? remaining / daysRemaining : remaining;
}
