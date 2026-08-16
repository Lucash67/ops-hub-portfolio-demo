"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ModuleShell } from "@/components/layout/module-shell";
import { PageLoader } from "@/components/ui/loading";
import { ChartCard } from "@/components/charts/chart-card";
import { ExecutiveSummary } from "@/components/executive/executive-summary";
import { SectionPanel } from "@/components/executive/section-panel";
import { Input } from "@/components/ui/input";
import { EmptyModuleState } from "@/components/ui/empty-module-state";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { formatCurrency } from "@/lib/utils";
import type { ProfitBankView } from "@/lib/profit-bank-service";
import { simulateProfitBank, simulationSummary } from "@/lib/profit-bank-view";
import { filterUpToDate } from "@/lib/temporal-filter";
import { isViewingGeneral, useTemporalViewContext } from "@/stores/temporal-context-store";
import { PiggyBank, Calculator } from "lucide-react";

export default function BancoLucroPage() {
  const { activeBusinessId, withQuery } = useBusinessScope();
  const context = useTemporalViewContext();
  const { data, isLoading, isError, error, refetch } = useQuery<ProfitBankView>({
    queryKey: ["profit-bank", activeBusinessId],
    queryFn: async () => {
      const r = await fetch(withQuery("/api/profit-bank"));
      const json = await r.json();
      if (!r.ok || json.error) throw new Error(json.error || "Não foi possível carregar o banco de lucro.");
      return json;
    },
    staleTime: 120_000,
  });

  const [saveRate, setSaveRate] = useState(100);
  const [monthlyWithdrawal, setMonthlyWithdrawal] = useState(0);
  const [horizonDays, setHorizonDays] = useState(90);

  const scopedHistory = useMemo(() => {
    if (!data) return [];
    return isViewingGeneral(context) ? data.history : filterUpToDate(data.history, context);
  }, [data, context]);

  const scopedBalance = scopedHistory.length ? scopedHistory[scopedHistory.length - 1]!.balance : 0;
  const scopedProfit = scopedHistory.reduce((s, d) => s + d.profit, 0);
  const scopedRevenue = scopedHistory.reduce((s, d) => s + d.revenue, 0);
  const scopedDays = scopedHistory.length;
  const scopedAvg = scopedDays > 0 ? scopedProfit / scopedDays : 0;

  const simulation = useMemo(() => {
    if (!data) return { points: [], summary: { finalBalance: 0, totalSaved: 0, totalWithdrawn: 0 } };
    const startBalance = isViewingGeneral(context) ? data.currentBalance : scopedBalance;
    const avgDaily = isViewingGeneral(context) ? data.avgDailyProfit : scopedAvg;
    const points = simulateProfitBank({
      startingBalance: startBalance,
      avgDailyProfit: avgDaily,
      saveRatePercent: saveRate,
      monthlyWithdrawal,
      horizonDays,
    });
    return { points, summary: simulationSummary(points) };
  }, [data, saveRate, monthlyWithdrawal, horizonDays, context, scopedBalance, scopedAvg]);

  if (isError) {
    return (
      <ModuleShell title="Banco de Lucro" subtitle="Acumulação e simulação de reserva">
        <p className="text-text-muted mb-3">
          {error instanceof Error ? error.message : "Não foi possível carregar o banco de lucro."}
        </p>
        <button type="button" className="text-sm text-brand-orange underline" onClick={() => void refetch()}>
          Tentar novamente
        </button>
      </ModuleShell>
    );
  }

  if (isLoading || !data) {
    return (
      <ModuleShell title="Banco de Lucro" subtitle="Acumulação e simulação de reserva">
        <PageLoader />
      </ModuleShell>
    );
  }

  const historyChart = scopedHistory.map((d) => ({
    label: d.label,
    value: d.balance,
    profit: d.profit,
    revenue: d.revenue,
  }));

  const simulationChart = simulation.points
    .filter(
      (_, i) =>
        i % Math.max(1, Math.floor(horizonDays / 30)) === 0 || i === simulation.points.length - 1,
    )
    .map((p) => ({ label: p.label, value: p.balance }));

  return (
    <ModuleShell title="Banco de Lucro" subtitle="Quanto você teria guardando o lucro operacional">
      <div className="space-y-6">
        {scopedDays === 0 ? (
          <EmptyModuleState
            icon={PiggyBank}
            title="Banco zerado"
            description="Sem dias operacionais ainda. O saldo acumulado e o gráfico aparecem após o primeiro lucro registrado."
            actionHref="/registro-dia"
            actionLabel="Registrar dia"
            compact
          />
        ) : null}

        <ExecutiveSummary
          theme="finance"
          title={
            isViewingGeneral(context)
              ? "Acumulado real (100% do lucro guardado)"
              : "Acumulado até o dia selecionado"
          }
          conclusion={
            scopedDays === 0
              ? "Nenhum lucro acumulado ainda — o banco começa em R$ 0,00."
              : isViewingGeneral(context)
                ? `Se você guardasse todo o lucro operacional desde o início, hoje teria ${formatCurrency(data.currentBalance)} reservados em ${data.operationalDays} dias de operação.`
                : `Até a data selecionada: ${formatCurrency(scopedBalance)} acumulados (${scopedDays} dias · lucro ${formatCurrency(scopedProfit)}).`
          }
          items={[
            {
              label: "Saldo acumulado",
              value: formatCurrency(isViewingGeneral(context) ? data.currentBalance : scopedBalance),
              highlight: true,
            },
            {
              label: "Lucro total",
              value: formatCurrency(isViewingGeneral(context) ? data.totalProfit : scopedProfit),
              highlight: true,
            },
            {
              label: "Receita total",
              value: formatCurrency(isViewingGeneral(context) ? data.totalRevenue : scopedRevenue),
            },
            {
              label: "Lucro médio/dia",
              value: formatCurrency(isViewingGeneral(context) ? data.avgDailyProfit : scopedAvg),
            },
          ]}
        />

        <ChartCard
          title="Evolução do banco"
          subtitle="Saldo acumulado dia a dia (lucro guardado)"
          data={historyChart}
          type="area"
          height={300}
        />

        <SectionPanel theme="goals" title="Simulador" subtitle="Projeção futura — não altera dados reais">
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-purple-500/20 bg-surface-card p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-text-primary">Parâmetros</span>
              </div>

              <label className="block text-sm">
                <span className="text-text-muted">% do lucro diário guardado</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={saveRate}
                  onChange={(e) =>
                    setSaveRate(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                  }
                  className="mt-1"
                />
              </label>

              <label className="block text-sm">
                <span className="text-text-muted">Retirada mensal (R$)</span>
                <Input
                  type="number"
                  min={0}
                  value={monthlyWithdrawal}
                  onChange={(e) => setMonthlyWithdrawal(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1"
                />
              </label>

              <label className="block text-sm">
                <span className="text-text-muted">Horizonte (dias)</span>
                <Input
                  type="number"
                  min={7}
                  max={365}
                  value={horizonDays}
                  onChange={(e) =>
                    setHorizonDays(Math.min(365, Math.max(7, Number(e.target.value) || 90)))
                  }
                  className="mt-1"
                />
              </label>

              <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
                <div>
                  <p className="text-text-muted text-xs">Saldo projetado</p>
                  <p className="font-bold text-brand-green">
                    {formatCurrency(simulation.summary.finalBalance)}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted text-xs">Total guardado</p>
                  <p className="font-bold">{formatCurrency(simulation.summary.totalSaved)}</p>
                </div>
              </div>
            </div>

            <ChartCard
              title="Projeção de saldo"
              subtitle={`Próximos ${horizonDays} dias · ${saveRate}% do lucro médio`}
              data={simulationChart}
              type="area"
              height={280}
            />
          </div>
        </SectionPanel>

        {data.bestDay && (
          <div className="flex items-center gap-3 rounded-xl border border-brand-green/20 bg-brand-green/5 p-4">
            <PiggyBank className="h-5 w-5 text-brand-green" />
            <p className="text-sm text-text-secondary">
              Melhor dia: <strong>{data.bestDay.date}</strong> com lucro de{" "}
              <strong>{formatCurrency(data.bestDay.profit)}</strong>
            </p>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
