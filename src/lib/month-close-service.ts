/**
 * Camada de dados do Fechamento & Tendência: carrega os dias operacionais
 * homologados (mesma base da dashboard), monta a previsão e aplica as metas.
 */
import { format } from "date-fns";
import { ALL_BUSINESSES_ID, isAllBusinesses } from "@/lib/business-units";
import { listDiaryEntries } from "@/lib/diary-service";
import { getInvestmentFinanceRecords } from "@/lib/finance";
import { buildOperationalDayMetrics, sortOperationalDays } from "@/lib/operational-day-metrics";
import { updateGoalTargets, type GoalTargetInput } from "@/lib/goals-service";
import {
  buildMonthCloseView,
  type ForecastScenarioKey,
  type MonthCloseInput,
  type MonthCloseView,
} from "@/lib/month-close-view";

function calendarScopeId(businessId: string): string {
  return isAllBusinesses(businessId) ? "salgados" : businessId;
}

async function loadInput(
  businessId: string,
  monthKey: string | undefined,
): Promise<MonthCloseInput> {
  const [metricsMap, diaryEntries, investments] = await Promise.all([
    buildOperationalDayMetrics(businessId),
    listDiaryEntries(businessId).catch(() => []),
    getInvestmentFinanceRecords(businessId).catch(() => []),
  ]);

  const bonusByDate: Record<string, number> = {};
  for (const entry of diaryEntries) {
    if (entry.bonusIncome && entry.bonusIncome > 0) {
      bonusByDate[entry.date] = entry.bonusIncome;
    }
  }

  return {
    businessId,
    calendarBusinessId: calendarScopeId(businessId),
    days: sortOperationalDays(metricsMap).map((day) => ({
      date: day.date,
      revenue: day.revenue,
      profit: day.profit,
      costs: day.costs,
      units: day.units,
    })),
    bonusByDate,
    investments: investments
      .filter((record) => record.type !== "withdrawal")
      .map((record) => ({
        date: record.date,
        amount: record.amount,
        own: record.sourceType === "own_capital",
      })),
    monthKey,
    today: format(new Date(), "yyyy-MM-dd"),
  };
}

export async function getMonthCloseView(
  businessId: string = ALL_BUSINESSES_ID,
  monthKey?: string,
): Promise<MonthCloseView | null> {
  const input = await loadInput(businessId, monthKey);
  return buildMonthCloseView(input);
}

export interface AppliedGoalsResult {
  scenario: ForecastScenarioKey;
  monthKey: string;
  monthLabel: string;
  applied: Array<{ type: string; label: string; targetRevenue: number; targetUnits: number }>;
}

/**
 * Grava as metas derivadas da previsão nas metas oficiais (diária/semanal/mensal/anual).
 *
 * Diária e semanal ficam ancoradas no período corrente (elas se movem sozinhas);
 * mensal e anual carregam o período de destino, para o progresso ser medido no
 * mês/ano certo mesmo antes do primeiro dia registrado.
 */
export async function applyForecastGoals(
  businessId: string,
  scenarioKey: ForecastScenarioKey = "realista",
  monthKey?: string,
): Promise<AppliedGoalsResult> {
  const view = await getMonthCloseView(businessId, monthKey);
  if (!view) {
    throw new Error("Ainda não há mês fechado com dados suficientes para gerar metas.");
  }

  const goals = view.derivedGoalsByScenario[scenarioKey];
  if (!goals) {
    throw new Error("Cenário de previsão inválido.");
  }

  const year = view.yearOutlook.year;
  const targets: Record<string, GoalTargetInput> = {};
  for (const goal of goals) {
    const base: GoalTargetInput = {
      amount: goal.targetRevenue,
      units: goal.targetUnits > 0 ? goal.targetUnits : null,
    };
    if (goal.type === "monthly") {
      base.periodStart = view.nextMonth.range.start;
      base.periodEnd = view.nextMonth.range.end;
    }
    if (goal.type === "yearly") {
      base.periodStart = `${year}-01-01`;
      base.periodEnd = `${year}-12-31`;
    }
    targets[goal.type] = base;
  }

  await updateGoalTargets(targets, businessId);

  return {
    scenario: scenarioKey,
    monthKey: view.nextMonth.monthKey,
    monthLabel: view.nextMonth.label,
    applied: goals.map((goal) => ({
      type: goal.type,
      label: goal.label,
      targetRevenue: goal.targetRevenue,
      targetUnits: goal.targetUnits,
    })),
  };
}
