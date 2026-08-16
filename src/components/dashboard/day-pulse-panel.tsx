"use client";

import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";

export interface DayPulse {
  revenue: number;
  profit: number;
  units: number;
  customers?: number;
  goalProgress?: number;
  goalRevenue?: number;
}

/** Mini painel do dia — sustenta a frase "desempenho de hoje". */
export function DayPulsePanel({
  pulse,
  className,
}: {
  pulse: DayPulse;
  className?: string;
}) {
  const hasGoal = (pulse.goalRevenue ?? 0) > 0;
  const progress = pulse.goalProgress ?? 0;

  return (
    <div
      className={cn(
        "rounded-2xl border border-brand-yellow/20 bg-surface-base/70 p-3.5 backdrop-blur-sm",
        className,
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
        Desempenho de hoje
      </p>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">
            Faturamento
          </p>
          <p className="text-2xl font-black leading-tight text-brand-yellow">
            {formatCurrency(pulse.revenue)}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">
            Lucro
          </p>
          <p className="text-lg font-bold leading-tight text-emerald-400">
            {formatCurrency(pulse.profit)}
          </p>
        </div>
      </div>

      <p className="mt-1 text-[11px] text-text-secondary">
        {pulse.units} un
        {pulse.customers != null ? ` · ${pulse.customers} clientes` : ""}
        {pulse.revenue > 0
          ? ` · ${Math.round((pulse.profit / pulse.revenue) * 100)}% margem`
          : ""}
      </p>

      {hasGoal && (
        <div className="mt-2.5 border-t border-surface-border/60 pt-2">
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <span className="text-text-muted">Meta do dia</span>
            <span className="font-bold text-text-secondary">
              {Math.round(progress)}% de {formatCurrency(pulse.goalRevenue ?? 0)}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-hover">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                progress >= 100 ? "bg-emerald-400" : "bg-brand-yellow",
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
