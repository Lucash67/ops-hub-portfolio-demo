"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Save, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { formatCurrency, cn } from "@/lib/utils";
import type { SmartGoalsView } from "@/lib/smart-goals-view";

interface GoalTargetEditorProps {
  view: SmartGoalsView;
}

export function GoalTargetEditor({ view }: GoalTargetEditorProps) {
  const { withQuery, canWrite, goalsBlockedMessage } = useBusinessScope();
  const queryClient = useQueryClient();
  const avgPrice = view.avgUnitPrice > 0 ? view.avgUnitPrice : 5;

  const [dailyUnits, setDailyUnits] = useState(String(view.editable.daily.effectiveUnits));
  const [dailyAmount, setDailyAmount] = useState(
    String(Math.round(view.editable.daily.effectiveAmount * 100) / 100),
  );
  const [weeklyUnits, setWeeklyUnits] = useState(String(view.editable.weekly.effectiveUnits));
  const [weeklyAmount, setWeeklyAmount] = useState(
    String(Math.round(view.editable.weekly.effectiveAmount * 100) / 100),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDailyUnits(String(view.editable.daily.effectiveUnits));
    setDailyAmount(String(Math.round(view.editable.daily.effectiveAmount * 100) / 100));
    setWeeklyUnits(String(view.editable.weekly.effectiveUnits));
    setWeeklyAmount(String(Math.round(view.editable.weekly.effectiveAmount * 100) / 100));
  }, [view]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["smart-goals"] });
    void queryClient.invalidateQueries({ queryKey: ["goals"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["period-projections"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const dUnits = Math.max(0, Math.round(Number(dailyUnits) || 0));
      const wUnits = Math.max(0, Math.round(Number(weeklyUnits) || 0));
      let dAmount = Number(dailyAmount);
      let wAmount = Number(weeklyAmount);
      if (!Number.isFinite(dAmount) || dAmount <= 0) dAmount = Math.round(dUnits * avgPrice * 100) / 100;
      if (!Number.isFinite(wAmount) || wAmount <= 0) wAmount = Math.round(wUnits * avgPrice * 100) / 100;

      const r = await fetch(withQuery("/api/goals"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets: {
            daily: { amount: dAmount, units: dUnits || null },
            weekly: { amount: wAmount, units: wUnits || null },
          },
        }),
      });
      const json = await r.json();
      if (!r.ok || json.error) throw new Error(json.error || "Não foi possível salvar a meta.");
      return json;
    },
    onSuccess: () => {
      setError(null);
      setMessage("Meta manual salva — ela passa a valer no sistema.");
      invalidate();
    },
    onError: (e: Error) => {
      setMessage(null);
      setError(e.message);
    },
  });

  const smartMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(withQuery("/api/goals"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useSmart: true, types: ["daily", "weekly", "monthly"] }),
      });
      const json = await r.json();
      if (!r.ok || json.error) throw new Error(json.error || "Não foi possível voltar à sugestão.");
      return json;
    },
    onSuccess: () => {
      setError(null);
      setMessage("Voltando à sugestão automática com base no seu histórico.");
      invalidate();
    },
    onError: (e: Error) => {
      setMessage(null);
      setError(e.message);
    },
  });

  const source = view.source;
  const suggested = view.suggested;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-brand-orange" />
            Definir meu alvo
          </CardTitle>
          <Badge
            className={cn(
              source === "manual"
                ? "bg-brand-orange/15 text-brand-orange"
                : "bg-brand-green/15 text-brand-green",
            )}
          >
            {source === "manual" ? "Manual ativa" : "Sugestão automática"}
          </Badge>
        </div>
        <p className="text-sm text-text-muted">
          Sugestão do sistema: <strong className="text-text-secondary">{suggested.daily.units} un./dia</strong>
          {" · "}
          {suggested.weekly.units} un./semana ({formatCurrency(suggested.weekly.revenue)}).
          {source === "manual"
            ? " Sua meta manual está valendo até você voltar à sugestão."
            : " Ajuste e salve se quiser um alvo diferente."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canWrite && (
          <p className="text-sm text-brand-red">{goalsBlockedMessage}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Unidades / dia"
            type="number"
            min={0}
            value={dailyUnits}
            disabled={!canWrite}
            onChange={(e) => {
              setDailyUnits(e.target.value);
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 0) {
                setDailyAmount(String(Math.round(n * avgPrice * 100) / 100));
              }
            }}
          />
          <Input
            label="Receita / dia (R$)"
            type="number"
            min={0}
            step="0.01"
            value={dailyAmount}
            disabled={!canWrite}
            onChange={(e) => setDailyAmount(e.target.value)}
          />
          <Input
            label="Unidades / semana"
            type="number"
            min={0}
            value={weeklyUnits}
            disabled={!canWrite}
            onChange={(e) => {
              setWeeklyUnits(e.target.value);
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 0) {
                setWeeklyAmount(String(Math.round(n * avgPrice * 100) / 100));
              }
            }}
          />
          <Input
            label="Receita / semana (R$)"
            type="number"
            min={0}
            step="0.01"
            value={weeklyAmount}
            disabled={!canWrite}
            onChange={(e) => setWeeklyAmount(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!canWrite || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Salvando..." : "Salvar minha meta"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canWrite || smartMutation.isPending}
            onClick={() => smartMutation.mutate()}
          >
            <RotateCcw className="h-4 w-4" />
            {smartMutation.isPending ? "Aplicando..." : "Usar sugestão automática"}
          </Button>
        </div>

        {message && <p className="text-sm text-brand-green">{message}</p>}
        {error && <p className="text-sm text-brand-red">{error}</p>}
      </CardContent>
    </Card>
  );
}
