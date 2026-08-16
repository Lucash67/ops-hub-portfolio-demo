"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Sparkles } from "lucide-react";
import { ExecutiveSummary } from "@/components/executive/executive-summary";
import { SectionPanel } from "@/components/executive/section-panel";
import { Badge } from "@/components/ui/badge";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { formatCurrency } from "@/lib/utils";
import type { DiaryAutoInsight } from "@/lib/diary-auto-insights";
import {
  isViewingGeneral,
  useTemporalViewContext,
} from "@/stores/temporal-context-store";
import { isAllBusinesses } from "@/lib/business-units";

const insightTypeBadge = {
  positive: "success" as const,
  warning: "warning" as const,
  info: "info" as const,
  opportunity: "info" as const,
};

interface DaySummaryResponse {
  date: string;
  metrics: { revenue: number; profit: number; costs: number; source: string };
  insights: DiaryAutoInsight[];
}

export function TemporalDayBanner() {
  const context = useTemporalViewContext();
  const { activeBusinessId, withQuery } = useBusinessScope();
  const dayScoped = !isViewingGeneral(context) && !isAllBusinesses(activeBusinessId);

  const { data, isLoading } = useQuery<DaySummaryResponse>({
    queryKey: ["temporal-day-summary", activeBusinessId, context.viewDate],
    queryFn: async () => {
      const r = await fetch(withQuery(`/api/temporal/day-summary?date=${context.viewDate}`));
      const json = await r.json();
      if (!r.ok || json.error) {
        throw new Error(json.error || "Não foi possível carregar o resumo do dia.");
      }
      return json;
    },
    enabled: dayScoped,
    staleTime: 120_000,
  });

  if (!dayScoped) return null;

  const dateLabel = format(parseISO(context.viewDate), "dd/MM/yyyy (EEEE)", { locale: ptBR });
  // Só exibe KPIs quando a resposta bate com o dia selecionado (evita flash de outro dia).
  const metricsReady =
    !isLoading && data && data.date === context.viewDate;

  return (
    <div className="space-y-4 mb-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-orange/25 bg-brand-orange/5 px-4 py-2 text-sm">
        <CalendarDays className="h-4 w-4 text-brand-orange shrink-0" />
        <span className="text-text-secondary">
          KPIs filtrados para <strong className="text-text-primary">{dateLabel}</strong>
        </span>
        <Link href="/diario" className="ml-auto text-brand-orange hover:underline text-xs font-medium">
          Abrir diário →
        </Link>
      </div>

      {isLoading && (
        <p className="text-sm text-text-muted px-1">Carregando resumo do dia…</p>
      )}

      {metricsReady && (
        <>
          <ExecutiveSummary
            theme="dashboard"
            title={`Resumo do dia ${format(parseISO(context.viewDate), "dd/MM")}`}
            conclusion={`Faturamento ${formatCurrency(data.metrics.revenue)} · lucro ${formatCurrency(data.metrics.profit)} · fonte: ${data.metrics.source === "diary" ? "diário homologado" : "vendas"}.`}
            items={[
              { label: "Faturamento", value: formatCurrency(data.metrics.revenue), highlight: true },
              { label: "Lucro", value: formatCurrency(data.metrics.profit), highlight: true },
              { label: "Custo operacional", value: formatCurrency(data.metrics.costs) },
            ]}
          />

          {data.insights.length > 0 && (
            <SectionPanel
              theme="dashboard"
              title="Insights automáticos do dia"
              subtitle="Gerados a partir de vendas + diário — complemente só o que o sistema não captura"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {data.insights.slice(0, 6).map((ins) => (
                  <div
                    key={ins.id}
                    className="rounded-xl border border-surface-border bg-surface-card/50 p-3"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-text-primary">{ins.title}</p>
                      {ins.metric && <Badge variant={insightTypeBadge[ins.type]}>{ins.metric}</Badge>}
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">{ins.description}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1 text-xs text-text-muted">
                <Sparkles className="h-3.5 w-3.5" />
                Mais detalhes em Diário Operacional
              </p>
            </SectionPanel>
          )}
        </>
      )}
    </div>
  );
}
