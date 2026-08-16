"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/components/ui/utils";

interface AlertStripProps {
  alerts: Array<{ id: string; title: string; type?: string }>;
}

export function AlertStrip({ alerts }: AlertStripProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-brand-orange/20 bg-brand-orange/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-brand-orange" />
          <p className="text-sm font-semibold text-brand-orange">Alertas & Oportunidades</p>
        </div>
        <Link
          href="/insights"
          className="flex items-center gap-1 text-xs font-medium text-brand-orange hover:underline"
        >
          Ver todos
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <ul className="space-y-2">
        {alerts.slice(0, 3).map((alert) => (
          <li
            key={alert.id}
            className={cn(
              "flex items-start gap-2 rounded-lg bg-surface-card/80 px-3 py-2 text-sm text-text-secondary",
            )}
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" />
            {alert.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
