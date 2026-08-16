"use client";

import { HeroMetric } from "@/components/executive/hero-metric";
import { GoalPeriodCard } from "@/components/goals/goal-period-card";
import { GoalStreakComparison } from "@/components/goals/goal-streak-comparison";
import { GoalBreakdownGrid } from "@/components/goals/goal-breakdown-grid";
import { GoalSimulator } from "@/components/goals/goal-simulator";
import { GoalMotivationPanel } from "@/components/goals/goal-motivation-panel";
import { GoalTargetEditor } from "@/components/goals/goal-target-editor";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { SmartGoalsView } from "@/lib/smart-goals-view";
import { Target, Calendar, CalendarDays, TrendingUp } from "lucide-react";

interface SmartGoalsDashboardProps {
  view: SmartGoalsView;
}

export function SmartGoalsDashboard({ view }: SmartGoalsDashboardProps) {
  const { daily, weekly, monthly } = view;

  return (
    <div className="space-y-4 sm:space-y-6">
      <GoalTargetEditor view={view} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <HeroMetric
          theme="goals"
          label="Meta de Hoje"
          value={daily.targetUnits}
          icon={Target}
          format="number"
          subtext={`${daily.achievedUnits} realizadas · ${daily.remainingUnits} faltam`}
          valueTone={daily.progressPercent >= 100 ? "success" : "default"}
        />
        <HeroMetric
          theme="goals"
          label="Probabilidade"
          value={daily.probabilityLabel}
          icon={TrendingUp}
          format="raw"
          subtext={daily.probabilityReason}
          valueTone={
            daily.probability === "high" ? "success" : daily.probability === "low" ? "warning" : "neutral"
          }
        />
        <HeroMetric
          theme="goals"
          label="Meta Semanal"
          value={weekly.progressPercent}
          icon={Calendar}
          format="percent"
          subtext={`${weekly.achievedUnits}/${weekly.targetUnits} un. · ${weekly.daysRemaining} dias úteis restantes`}
        />
        <HeroMetric
          theme="goals"
          label="Projeção Mensal"
          value={monthly.projectionRevenue}
          icon={CalendarDays}
          format="currency"
          trend={monthly.previousMonthChangePercent}
          trendLabel="vs mês anterior"
          subtext={`Lucro projetado: ${formatCurrency(monthly.projectionProfit)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GoalPeriodCard title="Meta de Hoje" period={daily} delay={0} />
        <GoalPeriodCard
          title="Meta da Semana"
          period={weekly}
          delay={1}
          extra={
            weekly.daysRemaining > 0 ? (
              <p className="mt-3 text-xs text-text-muted">
                {weekly.daysRemaining} dia{weekly.daysRemaining > 1 ? "s" : ""} útei
                {weekly.daysRemaining > 1 ? "s" : "l"} restante{weekly.daysRemaining > 1 ? "s" : ""} · média de{" "}
                {weekly.requiredDailyUnits} un./dia
              </p>
            ) : null
          }
        />
        <GoalPeriodCard
          title="Meta do Mês"
          period={monthly}
          delay={2}
          extra={
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-text-muted">Projeção receita</p>
                <p className="font-semibold">{formatCurrency(monthly.projectionRevenue)}</p>
              </div>
              <div>
                <p className="text-text-muted">Mês anterior</p>
                <p className="font-semibold">{formatCurrency(monthly.previousMonthRevenue)}</p>
              </div>
              <div>
                <p className="text-text-muted">vs anterior</p>
                <p
                  className={`font-semibold ${
                    monthly.previousMonthChangePercent >= 0 ? "text-brand-green" : "text-brand-red"
                  }`}
                >
                  {formatPercent(monthly.previousMonthChangePercent)}
                </p>
              </div>
            </div>
          }
        />
      </div>

      <GoalStreakComparison streak={view.streak} comparisons={view.comparisons} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GoalBreakdownGrid productGoals={view.productGoals} hourGoals={view.hourGoals} />
        </div>
        <GoalSimulator
          currentUnits={daily.achievedUnits}
          targetUnits={daily.targetUnits}
          avgUnitPrice={view.avgUnitPrice}
          avgUnitProfit={view.avgUnitProfit}
        />
      </div>

      <GoalMotivationPanel challenges={view.challenges} recommendations={view.recommendations} />
    </div>
  );
}
