"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  Flag,
  PiggyBank,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { motion } from "framer-motion";
import { ModuleShell } from "@/components/layout/module-shell";
import { ChartCard } from "@/components/charts/chart-card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SectionPanel } from "@/components/executive/section-panel";
import { ScenarioCard } from "@/components/month-close/scenario-card";
import { WeeklyPlanTable } from "@/components/month-close/weekly-plan-table";
import { WeekdayProfileCard } from "@/components/month-close/weekday-profile-card";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/loading";
import { EmptyModuleState } from "@/components/ui/empty-module-state";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { fetchJson } from "@/lib/api/safe-json";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type {
  AppliedGoalsResult,
} from "@/lib/month-close-service";
import type { ForecastScenarioKey, MonthCloseView } from "@/lib/month-close-view";

const CONFIDENCE_STYLE: Record<string, string> = {
  alta: "border-brand-green/25 bg-brand-green/5 text-brand-green",
  média: "border-brand-orange/25 bg-brand-orange/5 text-brand-orange",
  baixa: "border-brand-red/25 bg-brand-red/5 text-brand-red",
};

type MonthClosePayload = MonthCloseView | { empty: true; message?: string };

function isEmptyMonthClose(data: MonthClosePayload | undefined): data is { empty: true; message?: string } {
  return Boolean(data && "empty" in data && data.empty);
}

export default function FechamentoPage() {
  const { activeBusinessId, canWrite, withQuery, goalsBlockedMessage } = useBusinessScope();
  const queryClient = useQueryClient();
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [scenarioKey, setScenarioKey] = useState<ForecastScenarioKey | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<MonthClosePayload>({
    queryKey: ["month-close", activeBusinessId, monthKey],
    queryFn: async () =>
      (await fetchJson(
        withQuery(`/api/month-close${monthKey ? `?month=${monthKey}` : ""}`),
      )) as MonthClosePayload,
    staleTime: 120_000,
    retry: 1,
  });

  const applyGoals = useMutation<AppliedGoalsResult, Error, ForecastScenarioKey>({
    mutationFn: async (scenario) => {
      if (!data || isEmptyMonthClose(data)) {
        throw new Error("Registre alguns dias antes de aplicar metas.");
      }
      const response = await fetch(withQuery("/api/month-close"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, month: data.reference.monthKey }),
      });
      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error ?? "Não foi possível aplicar as metas.");
      }
      return json as AppliedGoalsResult;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
      void queryClient.invalidateQueries({ queryKey: ["smart-goals"] });
      void queryClient.invalidateQueries({ queryKey: ["period-projections"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-view"] });
    },
  });

  const view = data && !isEmptyMonthClose(data) ? data : null;
  const selected = scenarioKey ?? view?.recommended ?? "realista";
  const scenario = view?.scenarios.find((s) => s.key === selected) ?? view?.scenarios[1];
  const weeklyPlan = view?.weeklyPlanByScenario[selected] ?? view?.weeklyPlan ?? [];
  const derivedGoals = view?.derivedGoalsByScenario[selected] ?? view?.derivedGoals ?? [];

  const historyChart = useMemo(() => {
    if (!view || !scenario) return [];
    return [
      ...view.history.map((row) => ({
        label: row.label,
        value: row.revenue,
        revenue: row.revenue,
        profit: row.profit,
      })),
      {
        label: `${view.nextMonth.shortLabel} (prev.)`,
        value: scenario.revenue,
        revenue: scenario.revenue,
        profit: scenario.profit,
      },
    ];
  }, [view, scenario]);

  if (isError) {
    return (
      <ModuleShell title="Fechamento & Tendência" temporalFilter={false}>
        <EmptyModuleState
          icon={CalendarDays}
          title="Não foi possível carregar o fechamento"
          description={
            error instanceof Error ? error.message : "Não foi possível carregar o fechamento do mês."
          }
          onRetry={() => void refetch()}
        />
      </ModuleShell>
    );
  }

  if (isLoading) {
    return (
      <ModuleShell title="Fechamento & Tendência" temporalFilter={false}>
        <PageLoader />
      </ModuleShell>
    );
  }

  if (!view || isEmptyMonthClose(data) || !scenario) {
    return (
      <ModuleShell title="Fechamento & Tendência" temporalFilter={false}>
        <EmptyModuleState
          icon={CalendarDays}
          title="Ainda sem mês para fechar"
          description={
            (data && isEmptyMonthClose(data) && data.message) ||
            "Registre alguns dias operacionais. Quando houver histórico, o fechamento e as metas do próximo mês aparecem aqui."
          }
          actionHref="/registro-dia"
          actionLabel="Registrar dia"
        />
      </ModuleShell>
    );
  }

  const { reference, nextMonth, confidence, capitalPlan, milestones, tracking, yearOutlook } = view;

  return (
    <ModuleShell
      title="Fechamento & Tendência"
      subtitle={`${reference.label} fechado · previsão e metas para ${nextMonth.label}`}
      temporalFilter={false}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {view.availableMonths.map((month) => (
              <button
                key={month.monthKey}
                type="button"
                onClick={() => setMonthKey(month.monthKey)}
                className={cn(
                  "min-h-[36px] rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors sm:min-h-0 sm:py-1.5",
                  month.monthKey === reference.monthKey
                    ? "border-brand-orange/60 bg-brand-orange/10 text-brand-orange"
                    : "border-surface-border text-text-secondary hover:text-text-primary",
                )}
              >
                {month.label}
              </button>
            ))}
          </div>
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              CONFIDENCE_STYLE[confidence.level] ?? CONFIDENCE_STYLE["média"],
            )}
          >
            Confiança {confidence.level}
          </span>
        </div>

        <div className="rounded-2xl border border-brand-orange/25 bg-brand-orange/5 px-4 py-3 text-sm leading-relaxed text-text-secondary">
          <span className="font-medium text-text-primary">Leitura do fechamento: </span>
          {view.narrative}
        </div>

        <SectionPanel
          theme="finance"
          title={`Como ${reference.label} fechou`}
          subtitle={`${reference.daysOperated} dias operados de ${reference.daysAvailableSinceStart} possíveis · presença ${(reference.attendanceRate * 100).toFixed(0)}%`}
        >
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <KpiCard
              title="Faturamento"
              value={reference.revenue}
              icon={Wallet}
              subtitle={`${formatCurrency(reference.avgDailyRevenue)}/dia útil`}
              delay={0}
            />
            <KpiCard
              title="Lucro"
              value={reference.profit}
              icon={TrendingUp}
              variant="profit"
              subtitle={`${formatCurrency(reference.avgDailyProfit)}/dia · margem ${reference.margin.toFixed(1)}%`}
              delay={1}
            />
            <KpiCard
              title="Unidades"
              value={reference.units}
              icon={CalendarDays}
              format="number"
              subtitle={`${reference.avgDailyUnits.toFixed(1)} un./dia · ${formatCurrency(reference.avgUnitPrice)} por unidade`}
              delay={2}
            />
            <KpiCard
              title="Melhor dia"
              value={reference.bestDay?.profit ?? 0}
              icon={BadgeCheck}
              subtitle={
                reference.bestDay
                  ? `${reference.bestDay.label} · pior foi ${reference.worstDay?.label} com ${formatCurrency(reference.worstDay?.profit ?? 0)}`
                  : "—"
              }
              delay={3}
            />
          </div>
        </SectionPanel>

        <SectionPanel
          theme="goals"
          title={`Tendência para ${nextMonth.label}`}
          subtitle={`${nextMonth.daysAvailable} dias úteis disponíveis (${nextMonth.daysGrowthPercent > 0 ? "+" : ""}${nextMonth.daysGrowthPercent.toFixed(0)}% vs os ${reference.daysOperated} dias operados em ${reference.shortLabel}) · escolha o cenário que vira meta`}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {view.scenarios.map((row, index) => (
              <ScenarioCard
                key={row.key}
                scenario={row}
                selected={row.key === selected}
                recommended={row.key === view.recommended}
                onSelect={setScenarioKey}
                delay={index * 0.06}
              />
            ))}
          </div>
        </SectionPanel>

        <div className="card-surface p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-primary">
                Metas que saem deste cenário
              </h3>
              <p className="mt-0.5 text-xs text-text-muted">
                Aplicar grava estes valores nas metas oficiais (Dashboard, Metas, Projeções e
                Relatórios passam a medir por eles)
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <Button
                disabled={!canWrite || applyGoals.isPending}
                onClick={() => applyGoals.mutate(selected)}
              >
                <Target className="h-4 w-4" />
                {applyGoals.isPending ? "Aplicando..." : `Aplicar metas de ${nextMonth.shortLabel}`}
              </Button>
              {!canWrite && <p className="text-xs text-text-muted">{goalsBlockedMessage}</p>}
              {applyGoals.isSuccess && (
                <p className="text-xs text-brand-green">
                  Metas de {applyGoals.data.monthLabel} aplicadas com o cenário{" "}
                  {applyGoals.data.scenario}.
                </p>
              )}
              {applyGoals.isError && (
                <p className="text-xs text-brand-red">{applyGoals.error.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {derivedGoals.map((goal) => (
              <div
                key={goal.type}
                className="rounded-xl border border-surface-border bg-surface-elevated/40 p-4"
              >
                <p className="text-xs font-medium capitalize text-text-secondary">{goal.label}</p>
                <p className="mt-1 text-lg font-bold text-text-primary">
                  {formatCurrency(goal.targetRevenue)}
                </p>
                <p className="text-xs text-brand-green">
                  {formatCurrency(goal.targetProfit)} de lucro
                  {goal.targetUnits > 0 ? ` · ${formatNumber(goal.targetUnits)} un.` : ""}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{goal.basis}</p>
              </div>
            ))}
          </div>
        </div>

        {tracking && (
          <div
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm",
              tracking.status === "acima"
                ? "border-brand-green/25 bg-brand-green/5"
                : tracking.status === "abaixo"
                  ? "border-brand-red/25 bg-brand-red/5"
                  : "border-surface-border bg-surface-card",
            )}
          >
            <p className="font-medium text-text-primary">Previsão × realizado</p>
            <p className="mt-0.5 text-text-secondary">
              {tracking.message} Realizado {formatCurrency(tracking.realizedProfit)} contra{" "}
              {formatCurrency(tracking.expectedProfitSoFar)} previstos para{" "}
              {tracking.daysOperated} dia(s).
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <WeeklyPlanTable rows={weeklyPlan} monthLabel={nextMonth.label} />
          <div className="space-y-6">
            <WeekdayProfileCard rows={view.weekdayProfile} />
            {capitalPlan && (
              <div className="card-surface p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-brand-green" />
                  <h3 className="text-sm font-semibold text-text-primary">
                    Capital para {nextMonth.shortLabel}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-text-muted">Custo total previsto</p>
                    <p className="font-bold text-text-primary">
                      {formatCurrency(scenario.costs)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Do seu bolso</p>
                    <p className="font-bold text-brand-orange">
                      {formatCurrency(capitalPlan.forecastOwnCapital)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">De terceiros</p>
                    <p className="font-bold text-text-primary">
                      {formatCurrency(capitalPlan.forecastThirdPartyCapital)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Por dia útil</p>
                    <p className="font-bold text-text-primary">
                      {formatCurrency(capitalPlan.ownCapitalPerDay)}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-text-muted">
                  {capitalPlan.note} O lucro de {reference.shortLabel} cobre o capital próprio
                  previsto {capitalPlan.selfFundingRatio.toFixed(1)}×.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            data={historyChart}
            title="Histórico e previsão"
            subtitle="Faturamento e lucro por mês, com o mês seguinte projetado"
            type="area"
            height={280}
            showLegend
          />

          <div className="space-y-6">
            {milestones.length > 0 && (
              <div className="card-surface p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Flag className="h-4 w-4 text-brand-orange" />
                  <h3 className="text-sm font-semibold text-text-primary">
                    Próximos marcos de lucro acumulado
                  </h3>
                </div>
                <div className="space-y-3">
                  {milestones.map((milestone) => (
                    <div
                      key={milestone.amount}
                      className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-elevated/40 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {formatCurrency(milestone.amount)}
                        </p>
                        <p className="text-xs text-text-muted">
                          {milestone.operationalDaysAway}º dia útil do mês
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-brand-orange">
                        {milestone.dateLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card-surface p-4 sm:p-6">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Horizonte de {yearOutlook.year}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-text-muted">Realizado até agora</p>
                  <p className="font-bold text-text-primary">
                    {formatCurrency(yearOutlook.realizedProfit)}
                  </p>
                  <p className="text-xs text-text-muted">
                    de lucro · {formatCurrency(yearOutlook.realizedRevenue)} faturados
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">
                    Fechamento projetado ({yearOutlook.monthsRemaining} meses restantes)
                  </p>
                  <p className="font-bold text-brand-green">
                    {formatCurrency(yearOutlook.projectedProfit)}
                  </p>
                  <p className="text-xs text-text-muted">
                    de lucro · {formatCurrency(yearOutlook.projectedRevenue)} faturados
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <SectionPanel
          theme="alerts"
          title="O que os números estão dizendo"
          subtitle={confidence.reason}
        >
          <div className="space-y-2">
            {view.insights.map((insight, index) => (
              <motion.div
                key={insight}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.04 }}
                className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-card px-4 py-3 text-sm text-text-secondary"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />
                <p className="leading-relaxed">{insight}</p>
              </motion.div>
            ))}
          </div>
        </SectionPanel>
      </div>
    </ModuleShell>
  );
}
