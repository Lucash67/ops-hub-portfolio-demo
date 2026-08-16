"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { WeekPulse } from "@/lib/week-pulse";

/** Mini painel da semana em foco — sustenta a frase de saudação com números. */
export function WeekPulsePanel({
  pulse,
  className,
}: {
  pulse: WeekPulse;
  className?: string;
}) {
  const maxRevenue = Math.max(...pulse.days.map((day) => day.revenue), 1);
  const trend = pulse.profitTrend;

  return (
    <div
      className={cn(
        "rounded-2xl border border-brand-yellow/20 bg-surface-base/70 p-3.5 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
          {pulse.isFallback ? "Última semana" : "Semana"}
          <span className="ml-1.5 font-semibold normal-case tracking-normal text-text-secondary">
            {pulse.rangeLabel}
          </span>
        </p>
        {trend != null && (
          <span
            title="Lucro contra a semana anterior"
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              trend >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300",
            )}
          >
            {trend >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(Math.round(trend))}%
          </span>
        )}
      </div>

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
        {pulse.units} un · {pulse.operationalDays}{" "}
        {pulse.operationalDays === 1 ? "dia" : "dias"} · {Math.round(pulse.margin)}% margem
      </p>

      <div className="mt-2.5 flex items-end gap-1.5">
        {pulse.days.map((day, index) => (
          <div
            key={day.date}
            title={`${day.label} · ${formatCurrency(day.revenue)} · lucro ${formatCurrency(day.profit)}`}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
          >
            <div className="flex h-8 w-full items-end overflow-hidden rounded-[4px] bg-surface-hover/60">
              <motion.div
                initial={{ height: 0 }}
                animate={{
                  height:
                    day.revenue > 0
                      ? `${Math.max((day.revenue / maxRevenue) * 100, 14)}%`
                      : "0%",
                }}
                transition={{ delay: 0.12 + index * 0.05, duration: 0.5, ease: "easeOut" }}
                className={cn(
                  "w-full rounded-[4px]",
                  day.isFocus
                    ? "bg-gradient-to-t from-brand-yellow to-[#5EEAD4]"
                    : "bg-brand-yellow/35",
                )}
              />
            </div>
            <span
              className={cn(
                "text-[10px] leading-none",
                day.isFocus ? "font-bold text-brand-yellow" : "text-text-muted",
              )}
            >
              {day.label}
            </span>
          </div>
        ))}
      </div>

      {pulse.goalRevenue > 0 && (
        <div className="mt-2.5 border-t border-surface-border/60 pt-2">
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <span className="text-text-muted">Meta semanal</span>
            <span className="font-bold text-text-secondary">
              {Math.round(pulse.goalProgress)}% de {formatCurrency(pulse.goalRevenue)}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-hover">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(pulse.goalProgress, 100)}%` }}
              transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                pulse.goalProgress >= 100 ? "bg-emerald-400" : "bg-brand-yellow",
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
