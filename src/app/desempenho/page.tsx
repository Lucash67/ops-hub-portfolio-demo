"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ModuleShell } from "@/components/layout/module-shell";
import { PageLoader } from "@/components/ui/loading";
import { EmptyModuleState } from "@/components/ui/empty-module-state";
import { ChartCard } from "@/components/charts/chart-card";
import { ExecutiveSummary } from "@/components/executive/executive-summary";
import { SectionPanel } from "@/components/executive/section-panel";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { PerformanceView } from "@/lib/performance-service";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, ShoppingCart, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DesempenhoPage() {
  const { activeBusinessId, withQuery } = useBusinessScope();
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError, error, refetch } = useQuery<PerformanceView>({
    queryKey: ["performance", activeBusinessId, period, offset],
    queryFn: async () => {
      const r = await fetch(withQuery(`/api/performance?period=${period}&offset=${offset}`));
      const json = await r.json();
      if (!r.ok || json.error) {
        throw new Error(json.error || "Não foi possível carregar o desempenho.");
      }
      return json;
    },
    staleTime: 120_000,
  });

  if (isError) {
    return (
      <ModuleShell title="Desempenho" subtitle="Receita, lucro e custos por período">
        <EmptyModuleState
          title="Não foi possível carregar o desempenho"
          description={error instanceof Error ? error.message : "Tente novamente em instantes."}
          onRetry={() => void refetch()}
        />
      </ModuleShell>
    );
  }

  if (isLoading || !data) {
    return (
      <ModuleShell title="Desempenho" subtitle="Receita, lucro e custos por período">
        <PageLoader />
      </ModuleShell>
    );
  }

  const growthIcon = (value: number) =>
    value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;

  const RevenueGrowthIcon = growthIcon(data.comparison.revenueGrowth);
  const ProfitGrowthIcon = growthIcon(data.comparison.profitGrowth);
  const isEmptyPeriod = data.metrics.revenue === 0 && data.metrics.salesCount === 0;

  return (
    <ModuleShell title="Desempenho" subtitle="Visão semanal e mensal da operação">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex w-full rounded-xl border border-surface-border bg-surface-card p-1 sm:w-auto">
            {(["weekly", "monthly"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPeriod(p);
                  setOffset(0);
                }}
                className={cn(
                  "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors sm:flex-none sm:py-2",
                  period === p
                    ? "bg-brand-orange text-brand-on"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                {p === "weekly" ? "Semanal" : "Mensal"}
              </button>
            ))}
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button variant="outline" size="icon" className="shrink-0" onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-0 flex-1 text-center text-sm font-medium text-text-primary sm:min-w-[180px] sm:flex-none">
              {data.periodLabel}
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

        {isEmptyPeriod ? (
          <EmptyModuleState
            title="Período sem movimentação"
            description="Quando houver vendas ou diário neste intervalo, receita, lucro e gráficos aparecem aqui."
            actionHref="/vendas"
            actionLabel="Registrar venda"
            compact
          />
        ) : null}

        <ExecutiveSummary
          theme="performance"
          title="Resumo do período"
          conclusion={
            isEmptyPeriod
              ? "Nenhuma venda no período — números zerados até o primeiro registro."
              : `Comparado a ${data.comparison.previousLabel}: receita ${formatPercent(data.comparison.revenueGrowth)} · lucro ${formatPercent(data.comparison.profitGrowth)}.`
          }
          items={[
            { label: "Receita", value: formatCurrency(data.metrics.revenue), highlight: true },
            { label: "Lucro", value: formatCurrency(data.metrics.profit), highlight: true },
            { label: "Custos", value: formatCurrency(data.metrics.costs) },
            { label: "Margem", value: formatPercent(data.metrics.margin) },
          ]}
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KpiCard title="Faturamento" value={data.metrics.revenue} icon={RevenueGrowthIcon} trend={data.comparison.revenueGrowth} />
          <KpiCard title="Lucro" value={data.metrics.profit} icon={ProfitGrowthIcon} trend={data.comparison.profitGrowth} variant="profit" />
          <KpiCard title="Ticket médio" value={data.metrics.averageTicket} icon={Receipt} />
          <KpiCard title="Vendas" value={data.metrics.salesCount} icon={ShoppingCart} subtitle={`${data.metrics.itemsSold} itens`} format="number" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Evolução diária"
            subtitle={`${data.period === "weekly" ? "Semana" : "Mês"} · receita e lucro`}
            data={data.dailyChart}
            type="area"
            showLegend
          />
          <ChartCard
            title="Segunda a sexta"
            subtitle="Faturamento por dia da semana (dias úteis)"
            data={data.weekdayChart}
            type="area"
            showLegend
          />
        </div>

        <SectionPanel theme="performance" title="Comparativo" subtitle="Período anterior">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-surface-elevated p-4">
              <p className="text-xs text-text-muted">Receita anterior</p>
              <p className="text-xl font-bold">{formatCurrency(data.comparison.previousRevenue)}</p>
            </div>
            <div className="rounded-xl bg-surface-elevated p-4">
              <p className="text-xs text-text-muted">Lucro anterior</p>
              <p className="text-xl font-bold text-brand-green">{formatCurrency(data.comparison.previousProfit)}</p>
            </div>
          </div>
        </SectionPanel>
      </div>
    </ModuleShell>
  );
}
