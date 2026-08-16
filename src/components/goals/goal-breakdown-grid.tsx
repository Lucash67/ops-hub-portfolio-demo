"use client";

import { SectionPanel } from "@/components/executive/section-panel";
import { formatPercent } from "@/lib/utils";
import type { HourGoalRow, ProductGoalRow } from "@/lib/smart-goals-view";
import { Package, Clock } from "lucide-react";

interface GoalBreakdownGridProps {
  productGoals: ProductGoalRow[];
  hourGoals: HourGoalRow[];
}

function ProgressRow({ label, target, achieved, progressPercent }: {
  label: string;
  target: number;
  achieved: number;
  progressPercent: number;
}) {
  return (
    <div className="rounded-xl border border-purple-500/20 bg-surface-card p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-xs text-text-muted">
          {achieved} / {target}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
        <div
          className={`h-full rounded-full ${progressPercent >= 100 ? "bg-brand-green" : "bg-purple-500"}`}
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>
      <p className="text-xs text-text-muted mt-1">{formatPercent(progressPercent)}</p>
    </div>
  );
}

export function GoalBreakdownGrid({ productGoals, hourGoals }: GoalBreakdownGridProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionPanel theme="goals" title="Metas por Produto" subtitle="Distribuição baseada na demanda recente">
        {productGoals.length === 0 ? (
          <p className="text-sm text-text-muted">Sem histórico suficiente para metas por produto.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-purple-400" />
            </div>
            {productGoals.map((p) => (
              <ProgressRow
                key={p.name}
                label={p.name}
                target={p.target}
                achieved={p.achieved}
                progressPercent={p.progressPercent}
              />
            ))}
          </div>
        )}
      </SectionPanel>

      <SectionPanel theme="goals" title="Metas por Turno" subtitle="Manhã e tarde">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-purple-400" />
          </div>
          {hourGoals.map((h) => (
            <ProgressRow
              key={h.period}
              label={h.label}
              target={h.target}
              achieved={h.achieved}
              progressPercent={h.progressPercent}
            />
          ))}
        </div>
      </SectionPanel>
    </div>
  );
}
