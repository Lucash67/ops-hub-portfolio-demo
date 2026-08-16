"use client";

import { SectionPanel } from "@/components/executive/section-panel";
import type { GoalChallenge, GoalRecommendation } from "@/lib/smart-goals-view";
import { Zap, Lightbulb } from "lucide-react";

interface GoalMotivationPanelProps {
  challenges: GoalChallenge[];
  recommendations: GoalRecommendation[];
}

export function GoalMotivationPanel({ challenges, recommendations }: GoalMotivationPanelProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionPanel theme="goals" title="Desafios" subtitle="Motivação diária">
        <div className="space-y-2">
          {challenges.length === 0 ? (
            <p className="text-sm text-text-muted">Sem desafios ativos — meta já batida!</p>
          ) : (
            challenges.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-brand-orange/20 bg-brand-orange/5 px-4 py-3"
              >
                <span className="text-lg">{c.emoji}</span>
                <p className="text-sm text-text-primary">{c.message}</p>
              </div>
            ))
          )}
        </div>
      </SectionPanel>

      <SectionPanel theme="goals" title="Como atingir sua meta" subtitle="Recomendações inteligentes">
        <div className="space-y-2">
          {recommendations.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-3 rounded-xl border border-purple-500/20 bg-surface-card px-4 py-3"
            >
              <Lightbulb className="h-4 w-4 shrink-0 text-purple-400 mt-0.5" />
              <p className="text-sm text-text-secondary">{r.message}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-text-muted">
          <Zap className="h-3 w-3" />
          Baseado em CRM, Diário Operacional e histórico de vendas
        </div>
      </SectionPanel>
    </div>
  );
}
