"use client";

import { cn } from "@/components/ui/utils";
import { formatCurrency } from "@/lib/utils";
import type { WeekdayProfileRow } from "@/lib/month-close-view";

interface WeekdayProfileCardProps {
  rows: WeekdayProfileRow[];
}

const WEEKDAY_FULL: Record<number, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
};

export function WeekdayProfileCard({ rows }: WeekdayProfileCardProps) {
  const maxProfit = Math.max(...rows.map((r) => r.avgProfit), 1);

  return (
    <div className="card-surface p-4 sm:p-6">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-text-primary">Força por dia da semana</h3>
        <p className="mt-0.5 text-xs text-text-muted">
          Lucro médio de cada dia no histórico — é o peso usado para distribuir as metas semanais
        </p>
      </div>

      <div className="space-y-4">
        {rows.map((row) => {
          const delta = row.indexVsAverage - 100;
          return (
            <div key={row.weekday}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                <span className="text-text-secondary">
                  {WEEKDAY_FULL[row.weekday] ?? row.label}
                  <span className="ml-1.5 text-xs text-text-muted">
                    {row.sampleDays} dia{row.sampleDays > 1 ? "s" : ""}
                  </span>
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="font-medium text-text-primary">
                    {formatCurrency(row.avgProfit)}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      delta >= 5
                        ? "text-brand-green"
                        : delta <= -5
                          ? "text-brand-red"
                          : "text-text-muted",
                    )}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(0)}%
                  </span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    delta >= 5 ? "bg-brand-green" : delta <= -5 ? "bg-brand-red/70" : "bg-brand-orange",
                  )}
                  style={{ width: `${(row.avgProfit / maxProfit) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
