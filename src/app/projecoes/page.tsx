"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ModuleShell } from "@/components/layout/module-shell";
import { Card } from "@/components/ui/card";
import { ChartCard } from "@/components/charts/chart-card";
import { PageLoader } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SectionPanel } from "@/components/executive/section-panel";
import {
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Target,
  Wallet,
  Package,
  CalendarDays,
  Zap,
  Check,
} from "lucide-react";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { fetchJson, fetchJsonArray } from "@/lib/api/safe-json";
import type {
  PeriodProjectionPeriod,
  PeriodProjectionView,
  ProjectionScenarioKey,
} from "@/lib/period-projections-service";

interface SimulatorScenario {
  dailyUnits: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  monthlyUnits: number;
}

const PERIOD_OPTIONS: Array<{ id: PeriodProjectionPeriod; label: string }> = [
  { id: "weekly", label: "Semana" },
  { id: "monthly", label: "Mês" },
  { id: "bimonthly", label: "2 meses" },
  { id: "quarterly", label: "Trimestre" },
];

const SCENARIO_ORDER: ProjectionScenarioKey[] = ["conservador", "base", "otimista"];

const SCENARIO_ACCENT: Record<ProjectionScenarioKey, string> = {
  conservador: "text-blue-400",
  base: "text-brand-green",
  otimista: "text-brand-orange",
};

function isScenarioKey(value: string | null): value is ProjectionScenarioKey {
  return value === "conservador" || value === "base" || value === "otimista";
}

function isPeriod(value: string | null): value is PeriodProjectionPeriod {
  return (
    value === "weekly" ||
    value === "monthly" ||
    value === "bimonthly" ||
    value === "quarterly"
  );
}

function ProjecoesContent() {
  const { activeBusinessId, withQuery } = useBusinessScope();
  const searchParams = useSearchParams();
  const [period, setPeriod] = useState<PeriodProjectionPeriod>(() => {
    const p = searchParams.get("period");
    return isPeriod(p) ? p : "weekly";
  });
  const [offset, setOffset] = useState(() => {
    const o = Number(searchParams.get("offset") ?? "0");
    return Number.isFinite(o) ? Math.min(0, Math.trunc(o)) : 0;
  });
  const [selectedScenario, setSelectedScenario] = useState<ProjectionScenarioKey>(() => {
    const s = searchParams.get("scenario");
    return isScenarioKey(s) ? s : "base";
  });
  const [showSimulator, setShowSimulator] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<PeriodProjectionView>({
    queryKey: ["period-projections", activeBusinessId, period, offset],
    queryFn: async () =>
      (await fetchJson(
        withQuery(`/api/projections?period=${period}&offset=${offset}`),
      )) as PeriodProjectionView,
    staleTime: 120_000,
    retry: 1,
  });

  useEffect(() => {
    if (!data) return;
    if (!searchParams.get("scenario")) {
      setSelectedScenario(data.recommendedScenario);
    }
  }, [data, searchParams]);

  const { data: scenarios = [] } = useQuery<SimulatorScenario[]>({
    queryKey: ["projection-simulator", activeBusinessId],
    queryFn: () => fetchJsonArray<SimulatorScenario>(withQuery("/api/projections?mode=simulator")),
    enabled: showSimulator,
    staleTime: 300_000,
  });

  const activeSlice = data?.scenarios[selectedScenario] ?? data?.scenarios.base;

  const gapForScenario = useMemo(() => {
    if (!data || !activeSlice) return null;
    const remaining = data.operationalDays.remaining;
    const revenueToProjection = Math.max(0, activeSlice.revenue - data.actual.revenue);
    const profitToProjection = Math.max(0, activeSlice.profit - data.actual.profit);
    const unitsToProjection = Math.max(0, activeSlice.units - data.actual.units);
    const revenueToGoal = Math.max(0, data.goal.revenue - data.actual.revenue);
    const unitsToGoal =
      data.goal.units != null ? Math.max(0, data.goal.units - data.actual.units) : 0;
    const div = (n: number) => (remaining > 0 ? n / remaining : n);
    return {
      revenueToProjection,
      profitToProjection,
      unitsToProjection,
      revenueToGoal,
      unitsToGoal,
      requiredDailyRevenueToProjection: div(revenueToProjection),
      requiredDailyUnitsToProjection: div(unitsToProjection),
      requiredDailyRevenueToGoal: div(revenueToGoal),
      requiredDailyUnitsToGoal: div(unitsToGoal),
    };
  }, [data, activeSlice]);

  if (isError) {
    return (
      <ModuleShell title="Projeções" subtitle="Ritmo, cenários e o que falta">
        <p className="mb-3 text-text-muted">
          {error instanceof Error ? error.message : "Não foi possível carregar as projeções."}
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
      </ModuleShell>
    );
  }

  if (isLoading || !data || !activeSlice || !gapForScenario) {
    return (
      <ModuleShell title="Projeções" subtitle="Ritmo, cenários e o que falta">
        <PageLoader />
      </ModuleShell>
    );
  }

  const comparisonChart = [
    {
      label: "Receita",
      value: data.actual.revenue,
      revenue: activeSlice.revenue,
      profit: data.goal.revenue,
    },
    {
      label: "Lucro",
      value: data.actual.profit,
      revenue: activeSlice.profit,
      profit: 0,
    },
    {
      label: "Unidades",
      value: data.actual.units,
      revenue: activeSlice.units,
      profit: data.goal.units ?? 0,
    },
  ];

  return (
    <ModuleShell title="Projeções" subtitle="Ritmo atual × cenários × meta × o que falta">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap rounded-xl border border-surface-border bg-surface-card p-1">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPeriod(p.id);
                  setOffset(0);
                }}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4",
                  period === p.id
                    ? "bg-brand-orange text-brand-on"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button variant="outline" size="icon" className="shrink-0" onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-0 flex-1 text-center text-sm font-medium capitalize text-text-primary sm:min-w-[200px] sm:flex-none">
              {data.periodLabel}
              {!data.isCurrentPeriod && (
                <span className="ml-2 rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text-muted">
                  Ciclo fechado
                </span>
              )}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setOffset((o) => o + 1)}
              disabled={offset >= 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-orange/25 bg-brand-orange/5 px-4 py-3 text-sm text-text-secondary">
          <span className="font-medium text-text-primary">Leitura do período: </span>
          {data.insight}
        </div>

        <SectionPanel
          title="Cenários"
          subtitle="Conservador · Base (ritmo atual) · Otimista — toque para usar no ‘o que falta’"
        >
          <div className="grid gap-3 md:grid-cols-3">
            {SCENARIO_ORDER.map((key, index) => {
              const scenario = data.scenarios[key];
              const selected = selectedScenario === key;
              const recommended = data.recommendedScenario === key;
              return (
                <motion.button
                  key={key}
                  type="button"
                  onClick={() => setSelectedScenario(key)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-all",
                    selected
                      ? "border-brand-orange/60 bg-surface-card shadow-glow"
                      : "border-surface-border bg-surface-card/80 hover:border-brand-orange/25",
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm font-semibold", SCENARIO_ACCENT[key])}>
                          {scenario.label}
                        </p>
                        {recommended && (
                          <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-green">
                            sugerido
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-text-muted">{scenario.premise}</p>
                    </div>
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                        selected
                          ? "border-brand-orange bg-brand-orange text-brand-on"
                          : "border-surface-border text-transparent",
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">Receita prevista</p>
                  <p className="text-xl font-bold text-text-primary">
                    {formatCurrency(scenario.revenue)}
                  </p>
                  <p className="mt-1 text-sm text-brand-green">
                    Lucro {formatCurrency(scenario.profit)} · {formatNumber(scenario.units)} un.
                  </p>
                </motion.button>
              );
            })}
          </div>
        </SectionPanel>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KpiCard
            title="Receita realizada"
            value={data.actual.revenue}
            icon={Wallet}
            subtitle={`Ritmo ${formatCurrency(data.pace.revenue)}/dia útil`}
            delay={0}
          />
          <KpiCard
            title={`Receita · ${activeSlice.label}`}
            value={activeSlice.revenue}
            icon={TrendingUp}
            subtitle={`${data.operationalDays.elapsed}/${data.operationalDays.total} dias úteis`}
            delay={0.05}
          />
          <KpiCard
            title={`Lucro · ${activeSlice.label}`}
            value={activeSlice.profit}
            icon={Zap}
            variant="profit"
            subtitle={`Realizado ${formatCurrency(data.actual.profit)}`}
            delay={0.1}
          />
          <KpiCard
            title={`Unidades · ${activeSlice.label}`}
            value={activeSlice.units}
            icon={Package}
            format="number"
            subtitle={`${formatNumber(data.actual.units)} já vendidas`}
            delay={0.15}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionPanel
            title="Comparativo"
            subtitle={`Realizado × ${activeSlice.label} × meta`}
          >
            <div className="space-y-3">
              {[
                {
                  label: "Receita",
                  actual: data.actual.revenue,
                  projected: activeSlice.revenue,
                  goal: data.goal.revenue,
                },
                {
                  label: "Lucro",
                  actual: data.actual.profit,
                  projected: activeSlice.profit,
                  goal: 0,
                },
                {
                  label: "Unidades",
                  actual: data.actual.units,
                  projected: activeSlice.units,
                  goal: data.goal.units ?? 0,
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="rounded-xl border border-surface-border bg-surface-elevated/40 px-3 py-2.5 text-sm sm:grid sm:grid-cols-4 sm:gap-2 sm:py-2"
                >
                  <span className="font-medium text-text-primary">{row.label}</span>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 sm:mt-0 sm:contents">
                    <span className="text-text-secondary">
                      <span className="block text-[10px] uppercase tracking-wide text-text-muted sm:hidden">
                        Realizado
                      </span>
                      {row.label === "Unidades"
                        ? formatNumber(row.actual)
                        : formatCurrency(row.actual)}
                    </span>
                    <span className="text-brand-orange">
                      <span className="block text-[10px] uppercase tracking-wide text-text-muted sm:hidden">
                        Projetado
                      </span>
                      {row.label === "Unidades"
                        ? formatNumber(row.projected)
                        : formatCurrency(row.projected)}
                    </span>
                    <span className="text-text-muted">
                      <span className="block text-[10px] uppercase tracking-wide text-text-muted sm:hidden">
                        Meta
                      </span>
                      {row.goal > 0
                        ? row.label === "Unidades"
                          ? formatNumber(row.goal)
                          : formatCurrency(row.goal)
                        : "—"}
                    </span>
                  </div>
                </div>
              ))}
              <div className="hidden grid-cols-4 gap-2 px-3 text-[11px] uppercase tracking-wide text-text-muted sm:grid">
                <span />
                <span>Realizado</span>
                <span>{activeSlice.label}</span>
                <span>Meta</span>
              </div>
            </div>
          </SectionPanel>

          <SectionPanel
            title="O que falta"
            subtitle={
              data.isCurrentPeriod
                ? `${data.operationalDays.remaining} dia(s) útil(eis) · cenário ${activeSlice.label}`
                : `Período encerrado · cenário ${activeSlice.label}`
            }
          >
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-5 w-5 text-brand-orange" />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Para bater o cenário {activeSlice.label}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {gapForScenario.unitsToProjection > 0 || gapForScenario.revenueToProjection > 0
                      ? `${formatNumber(gapForScenario.unitsToProjection)} un. · ${formatCurrency(gapForScenario.revenueToProjection)} · ritmo sugerido ${Math.ceil(gapForScenario.requiredDailyUnitsToProjection)} un./dia`
                      : data.isCurrentPeriod
                        ? "Cenário já coberto pelo realizado."
                        : "Resultado do ciclo em relação a este cenário."}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Target className="mt-0.5 h-5 w-5 text-brand-orange" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Para bater a meta</p>
                  <p className="text-sm text-text-secondary">
                    {data.goal.source === "none"
                      ? "Defina metas semanal/mensal em Metas ou Configurações."
                      : gapForScenario.revenueToGoal > 0 || gapForScenario.unitsToGoal > 0
                        ? `${formatCurrency(gapForScenario.revenueToGoal)} restantes · ${formatCurrency(gapForScenario.requiredDailyRevenueToGoal)}/dia útil`
                        : "Meta de receita já atingida neste período."}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-surface-border bg-surface-card px-3 py-2 text-xs text-text-muted">
                Margem realizada: {data.actual.margin.toFixed(1)}% · Dias úteis:{" "}
                {data.operationalDays.elapsed}/{data.operationalDays.total}
              </div>
            </div>
          </SectionPanel>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <ChartCard
            data={data.dailyChart}
            title="Receita por dia útil"
            type="bar"
            height={300}
          />
          <ChartCard
            data={comparisonChart}
            title={`Realizado vs ${activeSlice.label} · meta como referência`}
            type="bar"
            height={300}
          />
        </div>

        <div className="space-y-3">
          <Button variant="outline" size="sm" onClick={() => setShowSimulator((v) => !v)}>
            {showSimulator ? "Ocultar simulador estático" : "Abrir simulador por unidades/dia"}
          </Button>

          {showSimulator && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <p className="text-sm text-text-muted">
                Simulação hipotética com preço/custo médio do catálogo (22 dias úteis fixos) —
                não substitui a projeção por ritmo acima.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {scenarios.map((p) => (
                  <Card key={p.dailyUnits} className="p-4 text-center sm:p-5">
                    <p className="mb-1 text-2xl font-bold text-brand-orange sm:text-3xl">
                      {p.dailyUnits}
                    </p>
                    <p className="mb-4 text-xs text-text-muted">unidades/dia</p>
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-xs text-text-muted">Receita mensal</p>
                        <p className="font-bold">{formatCurrency(p.monthlyRevenue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">Lucro mensal</p>
                        <p className="font-bold text-brand-green">
                          {formatCurrency(p.monthlyProfit)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}

export default function ProjecoesPage() {
  return (
    <Suspense
      fallback={
        <ModuleShell title="Projeções" subtitle="Ritmo, cenários e o que falta">
          <PageLoader />
        </ModuleShell>
      }
    >
      <ProjecoesContent />
    </Suspense>
  );
}
