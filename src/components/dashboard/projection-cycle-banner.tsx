"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { X, TrendingUp } from "lucide-react";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { fetchJson } from "@/lib/api/safe-json";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { ProjectionCycleClose } from "@/lib/period-projections-service";

const STORAGE_PREFIX = "lbo-proj-cycle-dismiss:";

function dismissKey(businessId: string, cycleKey: string) {
  return `${STORAGE_PREFIX}${businessId}:${cycleKey}`;
}

export function ProjectionCycleBanner() {
  const { activeBusinessId, withQuery } = useBusinessScope();
  const [dismissed, setDismissed] = useState(true);

  const { data: banner } = useQuery<ProjectionCycleClose | null>({
    queryKey: ["projection-cycle-banner", activeBusinessId],
    queryFn: async () => {
      const json = await fetchJson(withQuery("/api/projections?mode=cycle-banner"));
      return (json ?? null) as ProjectionCycleClose | null;
    },
    staleTime: 300_000,
    retry: 0,
  });

  useEffect(() => {
    if (!banner?.justClosed) {
      setDismissed(true);
      return;
    }
    try {
      const key = dismissKey(activeBusinessId, banner.cycleKey);
      setDismissed(localStorage.getItem(key) === "1");
    } catch {
      setDismissed(false);
    }
  }, [banner, activeBusinessId]);

  if (!banner?.justClosed || dismissed) return null;

  const vsBase =
    banner.projected.revenue > 0
      ? Math.round((banner.actual.revenue / banner.projected.revenue) * 100)
      : 0;

  return (
    <div className="mb-4 rounded-2xl border border-brand-orange/30 bg-brand-orange/5 px-4 py-3 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-orange">
            Ciclo fechado
          </p>
          <p className="mt-0.5 text-sm font-semibold text-text-primary capitalize">
            {banner.period === "weekly" ? "Semana" : "Mês"} · {banner.label}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Realizado {formatCurrency(banner.actual.profit)} de lucro ·{" "}
            {formatNumber(banner.actual.units)} un. ({vsBase}% da projeção Base de receita).
          </p>
          <Link
            href={banner.href}
            className="mt-2 inline-flex text-sm font-medium text-brand-orange hover:underline"
          >
            Ver projeções do ciclo
          </Link>
        </div>
        <button
          type="button"
          aria-label="Dispensar"
          onClick={() => {
            try {
              localStorage.setItem(dismissKey(activeBusinessId, banner.cycleKey), "1");
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
