"use client";

import { formatCurrency, formatNumber } from "@/lib/utils";
import type { WeekPlanRow } from "@/lib/month-close-view";

interface WeeklyPlanTableProps {
  rows: WeekPlanRow[];
  monthLabel: string;
}

export function WeeklyPlanTable({ rows, monthLabel }: WeeklyPlanTableProps) {
  const maxUnits = Math.max(...rows.map((r) => r.targetUnits), 1);
  const totals = rows.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.targetRevenue,
      profit: acc.profit + row.targetProfit,
      units: acc.units + row.targetUnits,
      days: acc.days + row.operationalDays,
    }),
    { revenue: 0, profit: 0, units: 0, days: 0 },
  );

  return (
    <div className="card-surface overflow-hidden">
      <div className="border-b border-surface-border px-4 py-4 sm:px-5">
        <h3 className="text-sm font-semibold text-text-primary">Plano semanal de {monthLabel}</h3>
        <p className="mt-0.5 text-xs text-text-muted">
          Metas distribuídas pelos dias úteis de cada semana, com peso pelo desempenho de cada dia
          da semana
        </p>
      </div>

      <div className="divide-y divide-surface-border">
        {rows.map((row) => (
          <div key={row.index} className="px-4 py-4 sm:px-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="text-sm font-medium text-text-primary">{row.label}</span>
                <span className="ml-2 text-xs text-text-muted">{row.rangeLabel}</span>
              </div>
              <span className="text-xs text-text-muted">
                {row.operationalDays} dia{row.operationalDays > 1 ? "s" : ""} útil
                {row.operationalDays > 1 ? "eis" : ""}
              </span>
            </div>

            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
              <div
                className="h-full rounded-full bg-brand-orange transition-all duration-500"
                style={{ width: `${(row.targetUnits / maxUnits) * 100}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
              <div>
                <span className="text-text-muted">Faturamento </span>
                <span className="font-medium text-text-primary">
                  {formatCurrency(row.targetRevenue)}
                </span>
              </div>
              <div>
                <span className="text-text-muted">Lucro </span>
                <span className="font-medium text-brand-green">
                  {formatCurrency(row.targetProfit)}
                </span>
              </div>
              <div>
                <span className="text-text-muted">Unidades </span>
                <span className="font-medium text-text-primary">
                  {formatNumber(row.targetUnits)}
                </span>
              </div>
              <div>
                <span className="text-text-muted">Por dia </span>
                <span className="font-medium text-text-primary">{row.dailyUnits} un.</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-surface-border bg-surface-elevated/40 px-4 py-3 text-xs sm:grid-cols-4 sm:px-5">
        <div>
          <span className="text-text-muted">Total mês </span>
          <span className="font-semibold text-text-primary">{formatCurrency(totals.revenue)}</span>
        </div>
        <div>
          <span className="text-text-muted">Lucro </span>
          <span className="font-semibold text-brand-green">{formatCurrency(totals.profit)}</span>
        </div>
        <div>
          <span className="text-text-muted">Unidades </span>
          <span className="font-semibold text-text-primary">{formatNumber(totals.units)}</span>
        </div>
        <div>
          <span className="text-text-muted">Dias úteis </span>
          <span className="font-semibold text-text-primary">{totals.days}</span>
        </div>
      </div>
    </div>
  );
}
