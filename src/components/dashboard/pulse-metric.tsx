"use client";

import { motion } from "framer-motion";
import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

export type PulseVariant = "gain" | "loss" | "revenue" | "meta" | "info" | "neutral";

const VARIANT_STYLES: Record<
  PulseVariant,
  { ring: string; glow: string; icon: string; value: string; blob: string }
> = {
  gain: {
    ring: "border-emerald-400/40",
    glow: "shadow-[0_0_32px_rgba(34,197,94,0.25)]",
    icon: "bg-emerald-500/20 text-emerald-400",
    value: "text-emerald-400",
    blob: "bg-emerald-500/15",
  },
  loss: {
    ring: "border-red-400/40",
    glow: "shadow-[0_0_32px_rgba(239,68,68,0.2)]",
    icon: "bg-red-500/20 text-red-400",
    value: "text-red-400",
    blob: "bg-red-500/15",
  },
  revenue: {
    ring: "border-blue-400/40",
    glow: "shadow-[0_0_32px_rgba(59,130,246,0.22)]",
    icon: "bg-blue-500/20 text-blue-400",
    value: "text-blue-400",
    blob: "bg-blue-500/15",
  },
  meta: {
    ring: "border-purple-400/40",
    glow: "shadow-[0_0_32px_rgba(168,85,247,0.22)]",
    icon: "bg-purple-500/20 text-purple-400",
    value: "text-purple-400",
    blob: "bg-purple-500/15",
  },
  info: {
    ring: "border-[#00D4A8]/40",
    glow: "shadow-[0_0_24px_rgba(0, 212, 168,0.18)]",
    icon: "bg-[#00D4A8]/20 text-[#00D4A8]",
    value: "text-[#00D4A8]",
    blob: "bg-[#00D4A8]/15",
  },
  neutral: {
    ring: "border-surface-border",
    glow: "",
    icon: "bg-surface-elevated text-text-secondary",
    value: "text-text-primary",
    blob: "bg-surface-elevated/80",
  },
};

interface PulseMetricProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  variant?: PulseVariant;
  format?: "currency" | "number" | "percent" | "raw";
  trend?: number;
  trendLabel?: string;
  subtext?: string;
  delay?: number;
  className?: string;
}

export function PulseMetric({
  label,
  value,
  icon: Icon,
  variant = "neutral",
  format: fmt = "currency",
  trend,
  trendLabel,
  subtext,
  delay = 0,
  className,
}: PulseMetricProps) {
  const v = VARIANT_STYLES[variant];
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
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay: delay * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-surface-card/90 p-3.5 backdrop-blur-sm sm:p-4",
        v.ring,
        v.glow,
        className,
      )}
    >
      <div className={cn("absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl", v.blob)} />
      <div className="relative flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            {label}
          </p>
          <p className={cn("text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl", v.value)}>
            {formatted}
          </p>
          {trend !== undefined && (
            <p
              className={cn(
                "mt-1.5 flex items-center gap-1 text-xs font-semibold",
                trend >= 0 ? "text-emerald-400" : "text-red-400",
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {formatPercent(Math.abs(trend))} {trendLabel}
            </p>
          )}
          {subtext && <p className="mt-1 text-xs text-text-secondary leading-snug">{subtext}</p>}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10",
            v.icon,
          )}
        >
          <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" strokeWidth={2} />
        </div>
      </div>
    </motion.div>
  );
}
