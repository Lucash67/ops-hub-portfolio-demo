"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { AppShell } from "@/components/layout/app-shell";
import { BusinessWriteNotice } from "@/components/business/business-write-notice";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/loading";
import { Settings, Moon, Sun, Download, Database } from "lucide-react";
import { useBusinessScope } from "@/hooks/use-business-scope";

interface GoalRow {
  id: string;
  type: string;
  targetAmount: number;
  targetUnits?: number | null;
  configuredAmount?: number;
  configuredUnits?: number | null;
  targetSource?: "custom" | "smart";
}

const emptyGoals = {
  daily: "0",
  weekly: "0",
  monthly: "0",
  yearly: "0",
  dailyUnits: "",
  weeklyUnits: "",
  monthlyUnits: "",
};

export default function ConfiguracoesPage() {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const { activeBusinessId, canWrite, withQuery, goalsBlockedMessage } = useBusinessScope();
  const [goals, setGoals] = useState(emptyGoals);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: goalRows, isLoading: goalsLoading } = useQuery<GoalRow[]>({
    queryKey: ["goals", activeBusinessId],
    queryFn: () => fetch(withQuery("/api/goals")).then((r) => r.json()),
  });

  useEffect(() => {
    if (!goalRows || !Array.isArray(goalRows)) return;
    const byType = Object.fromEntries(goalRows.map((g) => [g.type, g]));
    const amount = (g?: GoalRow) =>
      String(g?.configuredAmount ?? (g?.targetSource === "smart" ? 0 : g?.targetAmount) ?? 0);
    const units = (g?: GoalRow) => {
      const u = g?.configuredUnits ?? g?.targetUnits;
      return u != null && u > 0 ? String(u) : "";
    };
    setGoals({
      daily: amount(byType.daily),
      weekly: amount(byType.weekly),
      monthly: amount(byType.monthly),
      yearly: amount(byType.yearly),
      dailyUnits: units(byType.daily),
      weeklyUnits: units(byType.weekly),
      monthlyUnits: units(byType.monthly),
    });
  }, [goalRows]);

  const saveSettings = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const r = await fetch(withQuery("/api/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, businessId: activeBusinessId }),
      });
      const json = await r.json();
      if (!r.ok || json.error) {
        throw new Error(json.error || "Não foi possível salvar as configurações.");
      }
      return json;
    },
    onSuccess: () => {
      setSaveError(null);
      setSaveSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["smart-goals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (error: Error) => {
      setSaveSuccess(false);
      setSaveError(error.message);
    },
  });

  const handleBackup = async () => {
    const res = await fetch("/api/settings", { method: "POST" });
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lucas-business-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  if (goalsLoading) {
    return (
      <AppShell title="Configurações" subtitle="Personalize seu sistema">
        <PageLoader />
      </AppShell>
    );
  }

  return (
    <AppShell title="Configurações" subtitle="Personalize seu sistema">
      <div className="grid max-w-4xl gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Metas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canWrite && <BusinessWriteNotice message={goalsBlockedMessage} />}
            <p className="text-xs text-text-muted">
              Valores em branco/zero nas unidades e R$ fazem a meta voltar à sugestão automática em Metas Inteligentes.
              Prefira editar o dia a dia em <strong>/metas</strong>.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Meta Diária (un.)"
                type="number"
                value={goals.dailyUnits}
                onChange={(e) => setGoals({ ...goals, dailyUnits: e.target.value })}
                disabled={!canWrite}
              />
              <Input
                label="Meta Diária (R$)"
                type="number"
                value={goals.daily}
                onChange={(e) => setGoals({ ...goals, daily: e.target.value })}
                disabled={!canWrite}
              />
              <Input
                label="Meta Semanal (un.)"
                type="number"
                value={goals.weeklyUnits}
                onChange={(e) => setGoals({ ...goals, weeklyUnits: e.target.value })}
                disabled={!canWrite}
              />
              <Input
                label="Meta Semanal (R$)"
                type="number"
                value={goals.weekly}
                onChange={(e) => setGoals({ ...goals, weekly: e.target.value })}
                disabled={!canWrite}
              />
              <Input
                label="Meta Mensal (un.)"
                type="number"
                value={goals.monthlyUnits}
                onChange={(e) => setGoals({ ...goals, monthlyUnits: e.target.value })}
                disabled={!canWrite}
              />
              <Input
                label="Meta Mensal (R$)"
                type="number"
                value={goals.monthly}
                onChange={(e) => setGoals({ ...goals, monthly: e.target.value })}
                disabled={!canWrite}
              />
            </div>
            <Input
              label="Meta Anual (R$)"
              type="number"
              value={goals.yearly}
              onChange={(e) => setGoals({ ...goals, yearly: e.target.value })}
              disabled={!canWrite}
            />
            <Button
              onClick={() => {
                if (!canWrite) {
                  setSaveError(goalsBlockedMessage);
                  return;
                }
                setSaveError(null);
                saveSettings.mutate({
                  daily_goal: goals.daily || "0",
                  weekly_goal: goals.weekly || "0",
                  monthly_goal: goals.monthly || "0",
                  yearly_goal: goals.yearly || "0",
                  daily_goal_units: goals.dailyUnits,
                  weekly_goal_units: goals.weeklyUnits,
                  monthly_goal_units: goals.monthlyUnits,
                });
              }}
              size="lg"
              className="w-full sm:w-auto"
              disabled={!canWrite || saveSettings.isPending}
            >
              {saveSettings.isPending ? "Salvando..." : "Salvar Metas"}
            </Button>
            {saveError && <p className="text-sm text-brand-red">{saveError}</p>}
            {saveSuccess && <p className="text-sm text-brand-green">Metas salvas com sucesso.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              Tema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={theme === "light" ? "default" : "secondary"}
                onClick={() => setTheme("light")}
                className="h-20 flex-col gap-2"
              >
                <Sun className="h-6 w-6" />
                Light Mode
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "secondary"}
                onClick={() => setTheme("dark")}
                className="h-20 flex-col gap-2"
              >
                <Moon className="h-6 w-6" />
                Dark Mode
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Backup & Exportação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-text-secondary">
              Faça backup dos seus dados para manter tudo seguro.
            </p>
            <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={handleBackup}>
              <Download className="h-4 w-4" />
              Exportar Backup
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sobre</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-text-secondary">
              <p><strong className="text-text-primary">Ops Hub</strong></p>
              <p>Centro operacional — NovaTech Solutions (demo)</p>
              <p>Versão 1.0.0</p>
              <p className="text-xs text-text-muted mt-4">
                Sistema escalável para crescer do primeiro salgado vendido até uma operação completa.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
