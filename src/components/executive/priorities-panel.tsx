"use client";

import type { DashboardPriority } from "@/lib/dashboard-view";

interface PrioritiesPanelProps {
  priorities: DashboardPriority[];
}

export function PrioritiesPanel({ priorities }: PrioritiesPanelProps) {
  if (priorities.length === 0) {
    return (
      <p className="rounded-xl bg-surface-elevated px-4 py-5 text-sm text-text-muted">
        Nenhuma ação pendente — operação em dia.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {priorities.map((item, i) => (
        <li
          key={item.id}
          className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-elevated px-3 py-3"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-xs font-bold text-brand-orange">
            {i + 1}
          </span>
          <span className="text-sm font-medium text-text-primary">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
