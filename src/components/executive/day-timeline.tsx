"use client";

import { formatCurrency } from "@/lib/utils";
import { cn } from "@/components/ui/utils";
import { formatSaleShift } from "@/lib/sale-shift";
import type { DayTimelineGroup } from "@/lib/dashboard-view";
import { Clock } from "lucide-react";

interface DayTimelineProps {
  groups: DayTimelineGroup[];
}

const STATUS_STYLES = {
  success: "text-brand-green bg-brand-green/10",
  warning: "text-brand-orange bg-brand-orange/10",
  neutral: "text-text-muted bg-surface-elevated",
};

export function DayTimeline({ groups }: DayTimelineProps) {
  if (groups.length === 0) {
    return (
      <p className="rounded-xl bg-surface-elevated px-4 py-6 text-center text-sm text-text-muted">
        Nenhuma venda registrada neste dia.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.period}>
          <p className="label-upper mb-3">{group.label}</p>
          <div className="space-y-2">
            {group.entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-2 rounded-xl border border-surface-border bg-surface-elevated p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-orange/10">
                    <Clock className="h-4 w-4 text-brand-orange" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">
                      {formatSaleShift(entry.time)} · {entry.clientName}
                    </p>
                    <p className="text-xs text-text-secondary truncate">{entry.products}</p>
                    <p className="text-xs text-text-muted mt-0.5">{entry.paymentLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:shrink-0 sm:flex-col sm:items-end">
                  <p className="text-sm font-bold text-text-primary">{formatCurrency(entry.amount)}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      STATUS_STYLES[entry.statusTone],
                    )}
                  >
                    {entry.statusLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
