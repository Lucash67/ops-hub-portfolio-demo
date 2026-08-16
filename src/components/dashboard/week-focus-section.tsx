"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  Package,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { WeekPulse, WeekPulseDay } from "@/lib/week-pulse";

const WEEKDAY_FULL: Record<string, string> = {
  seg: "segunda",
  ter: "terça",
  qua: "quarta",
  qui: "quinta",
  sex: "sexta",
  sáb: "sábado",
  dom: "domingo",
};

/** Sem centavos e sem espaço: cabe nas colunas estreitas do celular. */
function compactBRL(value: number): string {
  return `R$${Math.round(value).toLocaleString("pt-BR")}`;
}

function TrendChip({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
        positive ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300",
      )}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : "−"}
      {Math.abs(Math.round(value))}% {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
  trend,
  delay,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "revenue" | "profit" | "units" | "goal";
  trend?: number | null;
  delay: number;
}) {
  const tones = {
    revenue: { border: "border-blue-400/30", text: "text-blue-400" },
    profit: { border: "border-emerald-400/30", text: "text-emerald-400" },
    units: { border: "border-purple-400/30", text: "text-purple-400" },
    goal: { border: "border-brand-yellow/30", text: "text-brand-yellow" },
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn("rounded-2xl border bg-surface-card/80 p-3.5", tones.border)}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-black leading-none tracking-tight sm:text-2xl", tones.text)}>
        {value}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-text-secondary">{hint}</span>
        {trend !== undefined && <TrendChip value={trend} label="vs anterior" />}
      </div>
    </motion.div>
  );
}

function DayBars({ days }: { days: WeekPulseDay[] }) {
  const max = Math.max(...days.map((day) => day.revenue), 1);

  return (
    <div className="flex h-full items-end gap-1 sm:gap-2">
      {days.map((day, index) => {
        const height = day.revenue > 0 ? Math.max((day.revenue / max) * 100, 8) : 0;
        return (
          <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="text-[10px] font-bold text-text-secondary sm:text-[11px]">
              {day.revenue > 0 ? (
                <>
                  <span className="lg:hidden">{compactBRL(day.revenue)}</span>
                  <span className="hidden lg:inline">{formatCurrency(day.revenue)}</span>
                </>
              ) : (
                "—"
              )}
            </span>
            <div className="flex h-20 w-full items-end overflow-hidden rounded-lg bg-surface-hover/50 sm:h-24">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ delay: 0.15 + index * 0.07, duration: 0.6, ease: "easeOut" }}
                className="w-full rounded-lg bg-gradient-to-t from-blue-500/70 via-blue-400/80 to-brand-yellow/80"
              />
            </div>
            <span className="text-[11px] font-semibold capitalize text-text-primary">
              {day.label}
            </span>
            <span className="text-[10px] text-emerald-400/90">
              {day.profit > 0 ? (
                <>
                  <span className="lg:hidden">{compactBRL(day.profit)}</span>
                  <span className="hidden lg:inline">{formatCurrency(day.profit)}</span>
                </>
              ) : (
                "—"
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Bloco principal do fim de semana: a semana operada ganha o topo da tela. */
export function WeekFocusSection({ pulse }: { pulse: WeekPulse }) {
  const operated = pulse.days.filter((day) => day.revenue > 0);
  const best = [...operated].sort((a, b) => b.profit - a.profit)[0] ?? null;
  const weakest =
    operated.length > 1 ? [...operated].sort((a, b) => a.profit - b.profit)[0] ?? null : null;
  const missingToGoal = Math.max(pulse.goalRevenue - pulse.revenue, 0);
  const maxMix = Math.max(...pulse.products.map((product) => product.units), 1);
  const mixUnits = pulse.products.reduce((total, product) => total + product.units, 0);
  const mixIdentified = pulse.mixIdentifiedUnits ?? 0;
  const mixAllocated = pulse.mixAllocatedUnits ?? 0;
  const mixHint =
    mixAllocated > 0
      ? `${mixUnits} un · ${mixIdentified} anotadas + rateio da compra`
      : `${mixUnits} un com sabor anotado`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mb-4 space-y-3"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-yellow/80">
            {pulse.isFallback ? "Última semana operada" : "Semana operada"} ·{" "}
            {pulse.rangeLabel}
          </p>
          <h2 className="text-xl font-black tracking-tight text-text-primary sm:text-2xl">
            Desempenho da semana
          </h2>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Link
            href="/desempenho"
            className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-surface-border bg-surface-card/70 px-3 py-2 text-xs font-bold text-text-secondary transition-colors hover:border-brand-yellow/40 hover:text-brand-yellow sm:min-h-0 sm:flex-none sm:py-1.5"
          >
            Desempenho completo
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/fechamento"
            className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-brand-yellow/30 bg-brand-yellow/10 px-3 py-2 text-xs font-bold text-brand-yellow transition-colors hover:bg-brand-yellow/20 sm:min-h-0 sm:flex-none sm:py-1.5"
          >
            <CalendarClock className="h-3.5 w-3.5" />
            Tendência do mês
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatCard
          label="Faturamento"
          value={formatCurrency(pulse.revenue)}
          hint={`${pulse.operationalDays} ${pulse.operationalDays === 1 ? "dia operado" : "dias operados"}`}
          tone="revenue"
          trend={pulse.revenueTrend}
          delay={0}
        />
        <StatCard
          label="Lucro"
          value={formatCurrency(pulse.profit)}
          hint={`${Math.round(pulse.margin)}% de margem`}
          tone="profit"
          trend={pulse.profitTrend}
          delay={0.06}
        />
        <StatCard
          label="Unidades"
          value={`${pulse.units}`}
          hint={
            pulse.operationalDays > 0
              ? `${Math.round(pulse.units / pulse.operationalDays)} un/dia em média`
              : "sem operação"
          }
          tone="units"
          delay={0.12}
        />
        <StatCard
          label="Meta semanal"
          value={pulse.goalRevenue > 0 ? `${Math.round(pulse.goalProgress)}%` : "—"}
          hint={
            pulse.goalRevenue <= 0
              ? "sem meta definida"
              : missingToGoal > 0
                ? `faltaram ${formatCurrency(missingToGoal)} de ${formatCurrency(pulse.goalRevenue)}`
                : `meta de ${formatCurrency(pulse.goalRevenue)} batida`
          }
          tone="goal"
          delay={0.18}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-blue-500/20 bg-surface-card/80 p-4 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-bold text-text-primary">Faturamento por dia</h3>
            </div>
            <span className="hidden text-[11px] text-text-muted sm:inline">valor em cima · lucro embaixo</span>
          </div>
          <DayBars days={pulse.days} />
        </div>

        <div className="space-y-3 lg:col-span-2">
          <div className="rounded-2xl border border-purple-500/20 bg-surface-card/80 p-4">
            <div className="mb-2.5 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 shrink-0 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Mix da semana</h3>
                  <p className="text-[10px] text-text-muted">{pulse.rangeLabel}</p>
                </div>
              </div>
              <span className="max-w-[48%] text-right text-[10px] leading-snug text-text-muted">
                {mixHint}
              </span>
            </div>
            {pulse.products.length === 0 ? (
              <p className="text-xs text-text-muted">
                Sem dados de sabor nesta semana (anote o produto na venda ou registre a compra do
                dia).
              </p>
            ) : (
              <div className="space-y-2">
                {pulse.products.slice(0, 5).map((product, index) => (
                  <div key={product.label}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-text-primary">{product.label}</span>
                      <span className="shrink-0 text-text-secondary">{product.units} un</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-hover/60">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(product.units / maxMix) * 100}%` }}
                        transition={{ delay: 0.2 + index * 0.07, duration: 0.55 }}
                        className={cn(
                          "h-full rounded-full",
                          index === 0
                            ? "bg-gradient-to-r from-purple-500 to-purple-300"
                            : "bg-purple-500/45",
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {best && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <Trophy className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                  Melhor dia
                </p>
                <p className="text-sm font-bold capitalize text-text-primary">
                  {WEEKDAY_FULL[best.label] ?? best.label} · {formatCurrency(best.profit)} de
                  lucro
                </p>
                {weakest && weakest.date !== best.date && (
                  <p className="text-[11px] text-text-secondary">
                    Mais fraco: {WEEKDAY_FULL[weakest.label] ?? weakest.label} com{" "}
                    {formatCurrency(weakest.profit)}
                  </p>
                )}
              </div>
            </div>
          )}

          {pulse.goalRevenue > 0 && (
            <div className="rounded-2xl border border-brand-yellow/20 bg-brand-yellow/[0.05] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-text-secondary">
                  <Target className="h-3.5 w-3.5 text-brand-yellow" />
                  Meta semanal
                </span>
                <span className="text-[11px] font-bold text-brand-yellow">
                  {Math.round(pulse.goalProgress)}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-hover">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pulse.goalProgress, 100)}%` }}
                  transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full",
                    pulse.goalProgress >= 100 ? "bg-emerald-400" : "bg-brand-yellow",
                  )}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
