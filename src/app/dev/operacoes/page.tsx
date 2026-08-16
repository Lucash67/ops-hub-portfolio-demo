"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/loading";
import { Activity } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OperationRow {
  id: string;
  createdAt: string;
  completedAt: string | null;
  operationType: string;
  status: string;
  source: string;
  rawText: string | null;
  durationMs: number | null;
  effectsCount: number;
  eventsCount: number;
  errorMessage: string | null;
}

const statusVariant: Record<string, "success" | "warning" | "default"> = {
  executed: "success",
  rejected: "warning",
  failed: "default",
  pending: "default",
};

const statusLabel: Record<string, string> = {
  executed: "Sucesso",
  rejected: "Rejeitada",
  failed: "Erro",
  pending: "Pendente",
};

function formatTime(iso: string) {
  return format(new Date(iso), "dd/MM HH:mm:ss", { locale: ptBR });
}

export default function DevOperacoesPage() {
  const { data, isLoading, isError, error } = useQuery<OperationRow[]>({
    queryKey: ["dev-operations"],
    queryFn: async () => {
      const r = await fetch("/api/operations");
      const json = await r.json();
      if (!r.ok || json.error) {
        throw new Error(json.error || "Não foi possível carregar operações.");
      }
      return json;
    },
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <AppShell title="Diagnóstico — Operações" subtitle="Somente desenvolvimento">
        <PageLoader />
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell title="Diagnóstico — Operações" subtitle="Somente desenvolvimento">
        <Card className="p-8 text-center">
          <p className="text-brand-red">{error instanceof Error ? error.message : "Erro ao carregar"}</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Diagnóstico — Operações"
      subtitle="Últimas 50 operações do Business Engine · somente desenvolvimento"
    >
      <div className="space-y-4">
        <Card className="border-brand-orange/20 bg-brand-orange/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Activity className="h-5 w-5 text-brand-orange" />
            <p className="text-sm text-text-secondary">
              Esta página não aparece no menu. Acesse diretamente em <code className="text-brand-orange">/dev/operacoes</code>.
            </p>
          </CardContent>
        </Card>

        {!data?.length && (
          <Card className="p-8 text-center">
            <p className="text-text-muted">Nenhuma operação registrada ainda.</p>
          </Card>
        )}

        {data?.map((op) => (
          <Card key={op.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-mono">{op.id.slice(0, 8)}…</CardTitle>
                <Badge variant={statusVariant[op.status] ?? "default"}>
                  {statusLabel[op.status] ?? op.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-text-muted text-xs">Horário</p>
                  <p>{formatTime(op.createdAt)}</p>
                </div>
                <div>
                  <p className="text-text-muted text-xs">Tipo</p>
                  <p>{op.operationType}</p>
                </div>
                <div>
                  <p className="text-text-muted text-xs">Duração</p>
                  <p>{op.durationMs != null ? `${op.durationMs} ms` : "—"}</p>
                </div>
                <div>
                  <p className="text-text-muted text-xs">Origem</p>
                  <p>{op.source}</p>
                </div>
                <div>
                  <p className="text-text-muted text-xs">Effects</p>
                  <p>{op.effectsCount}</p>
                </div>
                <div>
                  <p className="text-text-muted text-xs">Eventos</p>
                  <p>{op.eventsCount}</p>
                </div>
              </div>
              {op.rawText && (
                <div>
                  <p className="text-text-muted text-xs">Texto recebido</p>
                  <p className="font-mono text-text-secondary">{op.rawText}</p>
                </div>
              )}
              {op.errorMessage && (
                <div>
                  <p className="text-text-muted text-xs">Erro</p>
                  <p className="text-brand-red">{op.errorMessage}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
