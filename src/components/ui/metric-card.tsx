"use client";

import { cn } from "@/components/ui/utils";
import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

export type MetricValueColor = "default" | "orange" | "green" | "red";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: string;
  trend?: number;
  valueColor?: MetricValueColor;
  format?: "currency" | "number" | "percent" | "raw";
  compact?: boolean;
}

const valueColorMap: Record<MetricValueColor, string> = {
  default: "text-text-primary",
  orange: "text-brand-orange",
  green: "text-brand-green",
  red: "text-brand-red",
};

const iconBgMap: Record<MetricValueColor, string> = {
  default: "bg-surface-elevated text-text-muted",
  orange: "bg-brand-orange/10 text-brand-orange",
  green: "bg-brand-green/10 text-brand-green",
  red: "bg-brand-red/10 text-brand-red",
};

export function MetricCard({
  label,
  value,
  icon: Icon,
  subtext,
  trend,
  valueColor = "default",
  format: fmt = "currency",
  compact = false,
}: MetricCardProps) {
  const formattedValue =
    fmt === "currency"
      ? formatCurrency(Number(value))
      : fmt === "number"
        ? formatNumber(Number(value))
        : fmt === "percent"
          ? formatPercent(Number(value))
          : value;

  return (
    <div className={cn("card-surface transition-colors hover:border-surface-border/80", compact ? "p-3" : "p-4")}>
      <div className={cn("flex items-start justify-between gap-2", compact ? "mb-2" : "mb-3")}>
        <p className="label-upper">{label}</p>
        <div className={cn("flex shrink-0 items-center justify-center rounded-full", compact ? "h-7 w-7" : "h-8 w-8", iconBgMap[valueColor])}>
          <Icon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} strokeWidth={1.75} />
        </div>
      </div>
      <p className={cn(compact ? "text-lg font-semibold" : "text-xl font-semibold", "tracking-tight", valueColorMap[valueColor])}>
        {formattedValue}
      </p>
      {trend !== undefined && (
        <p className={cn("mt-2 flex items-center gap-1 text-xs font-medium", trend >= 0 ? "text-brand-green" : "text-brand-red")}>
          {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {formatPercent(Math.abs(trend))} vs ontem
        </p>
      )}
      {subtext && !trend && <p className="mt-2 text-xs text-text-muted">{subtext}</p>}
    </div>
  );
}
