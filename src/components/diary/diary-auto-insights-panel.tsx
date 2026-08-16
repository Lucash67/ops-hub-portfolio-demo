"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionPanel } from "@/components/executive/section-panel";
import { useBusinessScope } from "@/hooks/use-business-scope";
import type { DiaryAutoInsight } from "@/lib/diary-auto-insights";

const typeBadge = {
  positive: "success" as const,
  warning: "warning" as const,
  info: "info" as const,
  opportunity: "info" as const,
};

const categoryLabel: Record<DiaryAutoInsight["category"], string> = {
  mix: "Mix",
  rhythm: "Ritmo",
  client: "Clientes",
  compare: "Comparativo",
  stock: "Estoque",
  finance: "Financeiro",
};

export function DiaryAutoInsightsPanel({ date }: { date: string }) {
  const { activeBusinessId, withQuery } = useBusinessScope();

  const { data: insights = [], isLoading } = useQuery<DiaryAutoInsight[]>({
    queryKey: ["diary-auto-insights", activeBusinessId, date],
    queryFn: async () => {
      const r = await fetch(withQuery(`/api/diary/auto-insights?date=${date}`));
      const json = await r.json();
      return Array.isArray(json) ? json : [];
    },
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <SectionPanel theme="dashboard" title="Insights automáticos" subtitle="Analisando vendas e diário...">
        <p className="text-sm text-text-muted">Gerando conclusões...</p>
      </SectionPanel>
    );
  }

  if (insights.length === 0) return null;

  return (
    <SectionPanel
      theme="dashboard"
      title="Insights automáticos"
      subtitle="O sistema deduziu isto dos dados — use Observações apenas para contexto humano"
    >
      <div className="mb-3 flex items-center gap-2 text-xs text-text-muted">
        <Bot className="h-4 w-4 text-brand-orange" />
        {insights.length} conclusão(ões) · clientes, mix, comparativo e giro
      </div>
      <div className="space-y-3">
        {insights.map((ins) => (
          <div
            key={ins.id}
            className="rounded-xl border border-surface-border bg-surface-base/50 p-4"
          >
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="default">{categoryLabel[ins.category]}</Badge>
              {ins.metric && <Badge variant={typeBadge[ins.type]}>{ins.metric}</Badge>}
            </div>
            <p className="font-medium text-sm text-text-primary">{ins.title}</p>
            <p className="mt-1 text-sm text-text-secondary leading-relaxed">{ins.description}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-text-muted">
        <Sparkles className="h-3.5 w-3.5 text-brand-orange" />
        Oportunidades de negócio (ex.: festa ACAL, sabores novos) vão em Observações / Insights manuais.
      </p>
    </SectionPanel>
  );
}
