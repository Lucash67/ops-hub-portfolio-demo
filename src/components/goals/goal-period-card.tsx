"use client";

import { cn } from "@/components/ui/utils";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ProbabilityLevel, SmartGoalPeriod, TrendDirection } from "@/lib/smart-goals-view";
import { TrendingDown, TrendingUp, Minus, Target } from "lucide-react";

const PROBABILITY_STYLES: Record<ProbabilityLevel, { dot: string; bg: string; text: string }> = {
  high: { dot: "bg-brand-green", bg: "bg-brand-green/10", text: "text-brand-green" },
  medium: { dot: "bg-brand-orange", bg: "bg-brand-orange/10", text: "text-brand-orange" },
  low: { dot: "bg-brand-red", bg: "bg-brand-red/10", text: "text-brand-red" },
};

const TREND_ICONS: Record<TrendDirection, typeof TrendingUp> = {
  growing: TrendingUp,
  stable: Minus,
  declining: TrendingDown,
};

const TREND_COLORS: Record<TrendDirection, string> = {
  growing: "text-brand-green",
  stable: "text-text-secondary",
  declining: "text-brand-red",
};

interface GoalPeriodCardProps {
  title: string;
  period: SmartGoalPeriod;
  showRevenue?: boolean;
  delay?: number;
  extra?: React.ReactNode;
}

export function GoalPeriodCard({
  title,
  period,
  showRevenue = true,
  delay = 0,
  extra,
}: GoalPeriodCardProps) {
  const prob = PROBABILITY_STYLES[period.probability];
  const TrendIcon = TREND_ICONS[period.trend];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.08 }}
      className="rounded-2xl border border-purple-500/20 bg-surface-card p-4 shadow-card sm:p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10">
            <Target className="h-4 w-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-purple-400">{title}</h3>
            <p className="text-xs text-text-muted">
              {period.achievedUnits} / {period.targetUnits} un.
            </p>
          </div>
        </div>
        <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", prob.bg, prob.text)}>
          <span className={cn("h-2 w-2 rounded-full", prob.dot)} />
          {period.probabilityLabel}
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-text-secondary">Progresso</span>
          <span className="font-semibold text-text-primary">{formatPercent(period.progressPercent)}</span>
        </div>
        <div className="h-2.5 rounded-full bg-surface-elevated overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(period.progressPercent, 100)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              period.progressPercent >= 100 ? "bg-brand-green" : "bg-purple-500",
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-text-muted">Faltam</p>
          <p className="font-semibold text-text-primary">{period.remainingUnits} un.</p>
        </div>
        {period.daysRemaining > 0 && (
          <div>
            <p className="text-text-muted">Média/dia necessária</p>
            <p className="font-semibold text-text-primary">{period.requiredDailyUnits} un.</p>
          </div>
        )}
        {showRevenue && (
          <>
            <div>
              <p className="text-text-muted">Receita</p>
              <p className="font-semibold text-text-primary">{formatCurrency(period.achievedRevenue)}</p>
            </div>
            <div>
              <p className="text-text-muted">Lucro</p>
              <p className="font-semibold text-brand-green">{formatCurrency(period.achievedProfit)}</p>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        <TrendIcon className={cn("h-3.5 w-3.5", TREND_COLORS[period.trend])} />
        <span className={TREND_COLORS[period.trend]}>{period.trendLabel}</span>
        <span className="text-text-muted">·</span>
        <span className="text-text-muted">{period.probabilityReason}</span>
      </div>

      {period.rationale.length > 0 && (
        <div className="mt-3 rounded-xl bg-surface-elevated p-3 space-y-1">
          <p className="text-xs font-medium text-text-secondary">Por que essa meta?</p>
          {period.rationale.map((line) => (
            <p key={line} className="text-xs text-text-muted">
              {line}
            </p>
          ))}
        </div>
      )}

      {extra}
    </motion.div>
  );
}
