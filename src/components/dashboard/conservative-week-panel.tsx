"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Shield } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { ConservativeWeekForecast } from "@/lib/conservative-week-forecast";

/** Painel de domingo: projeção conservadora seg–sex. */
export function ConservativeWeekPanel({
  forecast,
  className,
}: {
  forecast: ConservativeWeekForecast;
  className?: string;
}) {
  const maxRevenue = Math.max(...forecast.days.map((day) => day.revenue), 1);

  return (
    <div
      className={cn(
        "rounded-2xl border border-emerald-500/25 bg-surface-base/70 p-3.5 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300/90">
          <Shield className="h-3 w-3" />
          Conservador
        </p>
        <span className="text-[10px] font-semibold text-text-secondary">
          {forecast.rangeLabel}
        </span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">
            Faturamento
          </p>
          <p className="text-2xl font-black leading-tight text-emerald-300">
            {formatCurrency(forecast.revenue)}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">
            Lucro
          </p>
          <p className="text-lg font-bold leading-tight text-brand-yellow">
            {formatCurrency(forecast.profit)}
          </p>
        </div>
      </div>

      <p className="mt-1 text-[11px] text-text-secondary">
        {forecast.units} un · ~{formatCurrency(forecast.dailyProfit)}/dia ·{" "}
        {forecast.days.length} dias úteis
      </p>

      <div className="mt-2.5 flex items-end gap-1.5">
        {forecast.days.map((day, index) => (
          <div
            key={day.date}
            title={`${day.label} · ${formatCurrency(day.revenue)} · lucro ${formatCurrency(day.profit)}`}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
          >
            <div className="flex h-8 w-full items-end overflow-hidden rounded-[4px] bg-surface-hover/60">
              <motion.div
                initial={{ height: 0 }}
                animate={{
                  height: `${Math.max((day.revenue / maxRevenue) * 100, 18)}%`,
                }}
                transition={{ delay: 0.12 + index * 0.05, duration: 0.5, ease: "easeOut" }}
                className="w-full rounded-[4px] bg-gradient-to-t from-emerald-600/80 to-emerald-300/90"
              />
            </div>
            <span className="text-[10px] font-semibold capitalize leading-none text-text-muted">
              {day.label}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-2.5 line-clamp-2 text-[10px] leading-snug text-text-muted">
        {forecast.premise}
      </p>

      <Link
        href="/fechamento"
        className="mt-2.5 inline-flex min-h-[32px] items-center gap-1 text-[11px] font-bold text-emerald-300 hover:text-emerald-200"
      >
        Ver cenários completos
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
