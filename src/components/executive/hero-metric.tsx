"use client";

import { cn } from "@/components/ui/utils";
import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ModuleTheme } from "@/lib/module-themes";
import { MODULE_THEMES } from "@/lib/module-themes";

interface HeroMetricProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  theme?: ModuleTheme;
  format?: "currency" | "number" | "percent" | "raw";
  trend?: number;
  trendLabel?: string;
  subtext?: string;
  delay?: number;
  valueTone?: "default" | "success" | "warning" | "neutral";
}

export function HeroMetric({
  label,
  value,
  icon: Icon,
  theme = "dashboard",
  format: fmt = "currency",
  trend,
  trendLabel = "vs ontem",
  subtext,
  delay = 0,
  valueTone = "default",
}: HeroMetricProps) {
  const t = MODULE_THEMES[theme];
  const valueColor =
    valueTone === "success"
      ? "text-brand-green"
      : valueTone === "warning"
        ? "text-brand-orange"
        : valueTone === "neutral"
          ? "text-text-secondary"
          : t.accent;
  const formatted =
    fmt === "currency"
      ? formatCurrency(Number(value))
      : fmt === "number"
        ? formatNumber(Number(value))
        : fmt === "percent"
          ? formatPercent(Number(value))
          : value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: delay * 0.06 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-surface-card p-4 shadow-card transition-all duration-200 hover:shadow-glow sm:p-5",
        t.border,
      )}
    >
      <div className={cn("absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-60", t.accentDim)} />
      <div className="relative flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="label-upper mb-1.5 sm:mb-2">{label}</p>
          <p className={cn("text-xl font-bold tracking-tight sm:text-3xl lg:text-4xl", valueColor)}>
            {formatted}
          </p>
          {trend !== undefined && (
            <p
              className={cn(
                "mt-2 flex items-center gap-1 text-xs font-medium",
                trend >= 0 ? "text-brand-green" : "text-brand-red",
              )}
            >
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPercent(Math.abs(trend))} {trendLabel}
            </p>
          )}
          {subtext && (
            <p className={cn("text-xs text-text-muted", trend !== undefined ? "mt-1" : "mt-2")}>{subtext}</p>
          )}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11",
            t.accentDim,
          )}
        >
          <Icon className={cn("h-[18px] w-[18px] sm:h-5 sm:w-5", t.accent)} strokeWidth={1.75} />
        </div>
      </div>
    </motion.div>
  );
}
