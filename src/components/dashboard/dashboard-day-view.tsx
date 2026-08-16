"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  Package,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  AlertTriangle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PulseMetric } from "@/components/dashboard/pulse-metric";
import { SalesDayTimeline } from "@/components/dashboard/sales-day-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import type { DiaryAutoInsight } from "@/lib/diary-auto-insights";
import type {
  CustomerDayInsight,
  DashboardActionableAlert,
  DayExecutiveSummary,
  DayTimelineGroup,
  OperationResult,
} from "@/lib/dashboard-view";

const HIDE_MONEY_KEY = "lbo-hide-money";
const MONEY_MASK = "R$ ••••";

interface FlavorRow {
  label: string;
  value: number;
}

interface DashboardDayViewProps {
  viewDate: string;
  viewingToday: boolean;
  revenue: number;
  profit: number;
  profitTrend?: number;
  revenueTrend?: number;
  trendLabel: string;
  goalProgress: number;
  goalUnits: number | null;
  soldUnits: number;
  profitMargin: number;
  bonusIncome?: number;
  operationResult: OperationResult;
  daySummary: DayExecutiveSummary;
  customerInsight: CustomerDayInsight;
  flavors: FlavorRow[];
  timeline: DayTimelineGroup[];
  alerts: DashboardActionableAlert[];
  insights: DiaryAutoInsight[];
  hasOperations: boolean;
  /** Sábado/domingo em negócio que não opera no fim de semana: não existe meta. */
  nonOperational?: boolean;
}

function MetaRing({ progress, sold, goal }: { progress: number; sold: number; goal: number | null }) {
  const pct = Math.min(progress, 100);
  const hit = goal != null && sold >= goal;

  return (
    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-surface-border" />
        <motion.circle
          cx="40"
          cy="40"
          r="34"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          className={hit ? "text-emerald-400" : "text-purple-400"}
          strokeDasharray={`${(pct / 100) * 213.6} 213.6`}
          initial={{ strokeDasharray: "0 213.6" }}
          animate={{ strokeDasharray: `${(pct / 100) * 213.6} 213.6` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="text-center">
        <p className={cn("text-lg font-bold", hit ? "text-emerald-400" : "text-purple-400")}>
          {Math.round(progress)}%
        </p>
        <p className="text-[9px] uppercase tracking-wide text-text-muted">meta</p>
      </div>
    </div>
  );
}

export function DashboardDayView({
  viewDate,
  viewingToday,
  revenue,
  profit,
  profitTrend,
  revenueTrend,
  trendLabel,
  goalProgress,
  goalUnits,
  soldUnits,
  profitMargin,
  bonusIncome,
  operationResult,
  daySummary,
  customerInsight,
  flavors,
  timeline,
  alerts,
  insights,
  hasOperations,
  nonOperational = false,
}: DashboardDayViewProps) {
  const [hideMoney, setHideMoney] = useState(false);

  useEffect(() => {
    try {
      setHideMoney(localStorage.getItem(HIDE_MONEY_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleHideMoney = () => {
    setHideMoney((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HIDE_MONEY_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const money = (value: number) => (hideMoney ? MONEY_MASK : formatCurrency(value));
  const idleDay = nonOperational && revenue === 0 && profit === 0;
  const profitPositive = profit >= 0;
  const maxFlavor = Math.max(...flavors.map((f) => f.value), 1);
  const dateLabel = format(parseISO(viewDate), "EEEE, dd 'de' MMMM", { locale: ptBR });

  return (
    <div className="space-y-5">
      {/* Hero — leitura em 3 segundos (espelha rascunho do dia) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "relative overflow-hidden rounded-3xl border p-4 sm:p-6",
          idleDay
            ? "border-surface-border bg-gradient-to-br from-surface-elevated/60 via-surface-card to-surface-card"
            : profitPositive
              ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-surface-card to-blue-500/10"
              : "border-red-500/30 bg-gradient-to-br from-red-500/15 via-surface-card to-[#00D4A8]/10",
        )}
      >
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />

        <button
          type="button"
          onClick={toggleHideMoney}
          aria-pressed={hideMoney}
          aria-label={hideMoney ? "Mostrar faturamento e lucro" : "Ocultar faturamento e lucro"}
          title={hideMoney ? "Mostrar valores" : "Ocultar valores"}
          className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-surface-border/80 bg-surface-base/80 text-text-secondary backdrop-blur-sm transition-colors hover:border-brand-yellow/40 hover:text-brand-yellow sm:right-4 sm:top-4"
        >
          {hideMoney ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 space-y-2.5 pr-12">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info" className="capitalize">{dateLabel}</Badge>
              {idleDay ? (
                <span className="inline-flex items-center rounded-full border border-[#00D4A8]/30 bg-[#00D4A8]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#00D4A8]">
                  Sem operação — Salgados não opera no fim de semana
                </span>
              ) : (
                operationResult.tone === "success" && (
                  <Badge variant="success">{operationResult.headline}</Badge>
                )
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-text-secondary mb-1">Lucro do dia</p>
              <motion.p
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
                className={cn(
                  "text-[2rem] font-black tracking-tight sm:text-4xl lg:text-5xl",
                  idleDay
                    ? "text-text-secondary"
                    : profitPositive
                      ? "text-emerald-400"
                      : "text-red-400",
                )}
              >
                {money(profit)}
              </motion.p>
              {bonusIncome != null && bonusIncome > 0 && (
                <p className="mt-1 text-sm text-purple-300 font-medium">
                  incl. {money(bonusIncome)} bonificação
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-blue-400 font-semibold">
                Faturamento {money(revenue)}
              </span>
              <span className="text-text-muted">·</span>
              <span className="text-purple-400 font-semibold">{soldUnits} un. vendidas</span>
              <span className="text-text-muted">·</span>
              <span className="text-text-secondary">
                {hideMoney ? "•••• margem" : `${formatPercent(profitMargin)} margem`}
              </span>
            </div>

            {profitTrend !== undefined && (
              <p
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
                  hideMoney
                    ? "bg-surface-elevated text-text-muted"
                    : profitTrend >= 0
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-red-500/20 text-red-300",
                )}
              >
                {!hideMoney &&
                  (profitTrend >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ))}
                {hideMoney
                  ? `Lucro •••• ${trendLabel}`
                  : `Lucro ${profitTrend >= 0 ? "+" : ""}${formatPercent(profitTrend)} ${trendLabel}`}
              </p>
            )}
          </div>

          {idleDay ? (
            <div className="shrink-0 rounded-2xl border border-surface-border bg-surface-base/50 px-4 py-3 text-right">
              <p className="text-xs text-text-muted">Meta do dia</p>
              <p className="text-2xl font-bold text-text-secondary">—</p>
              <p className="mt-1 max-w-[170px] text-xs text-text-secondary">
                Dia não operacional: nenhuma meta é cobrada aqui.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-4 sm:gap-6">
              <MetaRing progress={goalProgress} sold={soldUnits} goal={goalUnits} />
              <div className="min-w-0 space-y-1.5 text-sm sm:space-y-2 sm:text-right">
                <p className="text-text-muted">Meta do dia</p>
                <p className="text-2xl font-bold text-purple-400">
                  {goalUnits != null ? `${soldUnits}/${goalUnits}` : "—"}
                </p>
                <p className="max-w-[190px] text-xs text-text-secondary sm:max-w-[140px]">
                  {operationResult.summary}
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <PulseMetric
          label="Faturamento"
          value={hideMoney ? MONEY_MASK : revenue}
          format={hideMoney ? "raw" : "currency"}
          icon={TrendingUp}
          variant="revenue"
          trend={hideMoney ? undefined : revenueTrend}
          trendLabel={trendLabel}
          delay={0}
        />
        <PulseMetric
          label="Meta (unidades)"
          value={idleDay ? "—" : goalProgress}
          format={idleDay ? "raw" : "percent"}
          icon={Target}
          variant={idleDay ? "neutral" : "meta"}
          subtext={
            idleDay
              ? "Sem meta — dia não operacional"
              : goalUnits != null
                ? `${soldUnits} de ${goalUnits} un.`
                : `${soldUnits} un. vendidas`
          }
          delay={1}
        />
        <PulseMetric
          label="Pendências / Perdas"
          value={daySummary.pendingCount + daySummary.losses}
          format="number"
          icon={AlertTriangle}
          variant={daySummary.pendingCount + daySummary.losses > 0 ? "loss" : "gain"}
          subtext={
            daySummary.pendingCount + daySummary.losses > 0
              ? `${daySummary.pendingCount} fiado · ${daySummary.losses} perda(s)`
              : "Dia limpo — sem pendências"
          }
          delay={2}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Mix — barras vibrantes */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-blue-500/20 bg-surface-card/80 p-4 sm:p-5 lg:col-span-3"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-400" />
              <h3 className="font-semibold text-text-primary">Mix do dia</h3>
            </div>
            <span className="text-xs text-text-muted">{flavors.reduce((s, f) => s + f.value, 0)} un.</span>
          </div>
          {flavors.length === 0 ? (
            <p className="text-sm text-text-muted">Sem vendas com sabor identificado.</p>
          ) : (
            <div className="space-y-3">
              {flavors.slice(0, 5).map((f, i) => (
                <div key={f.label}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-text-primary">{f.label}</span>
                    <span className="shrink-0 text-text-secondary">{f.value} un.</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface-elevated">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(f.value / maxFlavor) * 100}%` }}
                      transition={{ delay: 0.3 + i * 0.08, duration: 0.6, ease: "easeOut" }}
                      className={cn(
                        "h-full rounded-full",
                        i === 0
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                          : i === 1
                            ? "bg-gradient-to-r from-blue-500 to-blue-400"
                            : "bg-gradient-to-r from-purple-500 to-purple-400",
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Cliente + alertas compactos */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="lg:col-span-2 space-y-3"
        >
          {customerInsight.topBuyer && (
            <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-500/10 to-transparent p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                    Maior comprador
                  </p>
                  <p className="font-semibold text-text-primary truncate">{customerInsight.summary}</p>
                  <p className="text-lg font-bold text-blue-400 mt-0.5">
                    {formatCurrency(customerInsight.topBuyer.total)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {alerts.length > 0 && (
            <div className="rounded-2xl border border-[#00D4A8]/25 bg-[#00D4A8]/5 p-4 space-y-2">
              {alerts.slice(0, 2).map((a) => (
                <p key={a.id} className="text-xs text-text-secondary leading-relaxed flex gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#00D4A8] mt-0.5" />
                  {a.message}
                </p>
              ))}
            </div>
          )}

          <Link href="/diario">
            <Button variant="outline" size="sm" className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10">
              <BookOpen className="h-4 w-4" />
              Abrir diário completo
              <ArrowRight className="h-3.5 w-3.5 ml-auto" />
            </Button>
          </Link>
        </motion.div>
      </div>

      {/* Insights automáticos — preview */}
      {insights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4"
        >
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-text-primary">Leitura rápida</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {insights.slice(0, 3).map((ins, i) => (
              <motion.div
                key={ins.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.06 }}
                className="rounded-xl border border-surface-border/80 bg-surface-card/60 px-3 py-2.5"
              >
                <p className="text-xs font-semibold text-text-primary">{ins.title}</p>
                <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-2">{ins.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Timeline — só se houve operação */}
      {hasOperations && timeline.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-surface-card via-surface-card to-emerald-500/5 p-4 sm:p-6"
        >
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">
                Histórico de vendas
              </p>
              <h3 className="text-lg font-bold text-text-primary">
                {viewingToday ? "Movimentações de hoje" : `Movimentações · ${format(parseISO(viewDate), "dd/MM")}`}
              </h3>
            </div>
            <p className="text-xs text-text-muted">Linha do tempo por período do dia</p>
          </div>
          <SalesDayTimeline groups={timeline} />
        </motion.div>
      )}
    </div>
  );
}
