"use client";

import { motion } from "framer-motion";
import { cn } from "@/components/ui/utils";
import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  subtitle?: string;
  variant?: "default" | "profit" | "alert";
  delay?: number;
  format?: "currency" | "number" | "percent" | "raw";
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  variant = "default",
  delay = 0,
  format: fmt = "currency",
}: KpiCardProps) {
  const formattedValue =
    fmt === "currency"
      ? formatCurrency(Number(value))
      : fmt === "number"
        ? formatNumber(Number(value))
        : fmt === "percent"
          ? formatPercent(Number(value))
          : value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.05 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-surface-border bg-surface-card p-4 shadow-card transition-all duration-300 hover:border-brand-orange/20 hover:shadow-glow sm:p-5",
        variant === "profit" && "border-brand-green/20",
        variant === "alert" && "border-brand-red/20"
      )}
    >
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-brand-orange/5 transition-transform duration-500 group-hover:scale-150" />

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-2 sm:space-y-3">
          <p className="text-[13px] font-medium text-text-secondary sm:text-sm">{title}</p>
          <p
            className={cn(
              "text-xl font-bold tracking-tight text-text-primary sm:text-2xl",
              variant === "profit" && "text-brand-green",
              variant === "alert" && "text-brand-red"
            )}
          >
            {formattedValue}
          </p>
          {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
          {trend !== undefined && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                trend >= 0 ? "text-brand-green" : "text-brand-red"
              )}
            >
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPercent(Math.abs(trend))} vs ontem
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange transition-colors group-hover:bg-brand-orange/20 sm:h-11 sm:w-11",
            variant === "profit" && "bg-brand-green/10 text-brand-green group-hover:bg-brand-green/20",
            variant === "alert" && "bg-brand-red/10 text-brand-red group-hover:bg-brand-red/20"
          )}
        >
          <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
        </div>
      </div>
    </motion.div>
  );
}
