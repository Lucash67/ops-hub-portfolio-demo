"use client";

import { SectionPanel } from "@/components/executive/section-panel";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { ComparisonRow, StreakInfo } from "@/lib/smart-goals-view";
import { Flame, Trophy, ArrowRightLeft } from "lucide-react";

interface GoalStreakComparisonProps {
  streak: StreakInfo;
  comparisons: ComparisonRow[];
}

export function GoalStreakComparison({ streak, comparisons }: GoalStreakComparisonProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionPanel theme="goals" title="Sequência" subtitle="Consistência operacional">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-purple-500/20 bg-surface-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-4 w-4 text-brand-orange" />
              <span className="text-xs text-text-muted">Sequência atual</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">{streak.current}</p>
            <p className="text-xs text-text-muted mt-1">{streak.currentLabel}</p>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-surface-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-brand-green" />
              <span className="text-xs text-text-muted">Melhor sequência</span>
            </div>
            <p className="text-2xl font-bold text-brand-green">{streak.best}</p>
            <p className="text-xs text-text-muted mt-1">{streak.bestLabel}</p>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel theme="goals" title="Comparativos" subtitle="Hoje, semana e mês">
        <div className="space-y-2">
          {comparisons.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-purple-500/20 bg-surface-card px-4 py-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-purple-400" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{row.label}</p>
                  <p className="text-xs text-text-muted truncate">{row.conclusion}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-text-primary">
                  {row.label.includes("receita") ? formatCurrency(row.current) : row.current}
                </p>
                <p
                  className={`text-xs font-medium ${
                    row.changePercent >= 0 ? "text-brand-green" : "text-brand-red"
                  }`}
                >
                  {row.changePercent >= 0 ? "+" : ""}
                  {formatPercent(row.changePercent)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SectionPanel>
    </div>
  );
}
