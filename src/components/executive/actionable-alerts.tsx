"use client";

import { AlertTriangle, Lightbulb, Info } from "lucide-react";
import { cn } from "@/components/ui/utils";
import type { DashboardActionableAlert } from "@/lib/dashboard-view";

interface ActionableAlertsProps {
  alerts: DashboardActionableAlert[];
}

const ICONS = {
  warning: AlertTriangle,
  opportunity: Lightbulb,
  info: Info,
};

const STYLES = {
  warning: "border-brand-orange/30 bg-brand-orange/5 text-brand-orange",
  opportunity: "border-brand-green/30 bg-brand-green/5 text-brand-green",
  info: "border-blue-500/30 bg-blue-500/5 text-blue-400",
};

export function ActionableAlerts({ alerts }: ActionableAlertsProps) {
  if (alerts.length === 0) {
    return (
      <p className="rounded-xl bg-surface-elevated px-4 py-5 text-sm text-text-muted">
        Nenhum alerta operacional para este dia.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.map((alert) => {
        const Icon = ICONS[alert.severity];
        return (
          <li
            key={alert.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-3 py-3 text-sm text-text-secondary",
              STYLES[alert.severity],
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{alert.message}</span>
          </li>
        );
      })}
    </ul>
  );
}
