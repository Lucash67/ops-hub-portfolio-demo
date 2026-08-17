"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppShell } from "@/components/layout/app-shell";
import { ModuleShell } from "@/components/layout/module-shell";
import { DiaryAutoInsightsPanel } from "@/components/diary/diary-auto-insights-panel";
import { BusinessWriteNotice } from "@/components/business/business-write-notice";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/loading";
import { SectionPanel } from "@/components/executive/section-panel";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { isAllBusinesses, getBusinessUnitName } from "@/lib/business-units";
import { formatCurrency } from "@/lib/utils";
import { useTemporalContextStore, useViewDate } from "@/stores/temporal-context-store";
import type { OperationalDiaryEntry } from "@/lib/diary/types";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Save,
  Lightbulb,
  Target,
  Sparkles,
} from "lucide-react";

type DiaryEntry = OperationalDiaryEntry & { id?: string; createdAt?: string };

function emptyEntry(businessId: string, date: string): OperationalDiaryEntry {
  return {
    version: 1,
    businessId,
    date,
    revenue: { received: 0, pending: 0, total: 0 },
    profit: 0,
    quantitySold: 0,
    quantityLost: 0,
  };
}

function DiarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4">
      <h3 className="label-upper mb-3">{title}</h3>
      {children}
    </div>
  );
}

function DiaryView({ entry }: { entry: DiaryEntry }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DiarySection title="Meta do dia">
          <p className="text-xl font-bold">{entry.dailyGoalUnits ?? "—"} un.</p>
        </DiarySection>
        <DiarySection title="Receita total">
          <p className="text-xl font-bold text-brand-orange">{formatCurrency(entry.revenue.total)}</p>
          <p className="text-xs text-text-muted mt-1">
            Recebida {formatCurrency(entry.revenue.received)}
            {entry.revenue.pending > 0 && ` · Pendente ${formatCurrency(entry.revenue.pending)}`}
          </p>
        </DiarySection>
        <DiarySection title="Lucro">
          <p className="text-xl font-bold text-brand-green">{formatCurrency(entry.profit)}</p>
        </DiarySection>
        <DiarySection title="Quantidades">
          <p className="text-sm">
            <span className="text-text-muted">Vendidas:</span>{" "}
            <strong>{entry.quantitySold}</strong>
          </p>
          {entry.quantityLost > 0 && (
            <p className="text-sm text-brand-red mt-1">
              Perdidas: {entry.quantityLost}
              {entry.lossReason && ` (${entry.lossReason})`}
            </p>
          )}
        </DiarySection>
      </div>

      {entry.purchase && (
        <DiarySection title="Compra do dia">
          <p className="text-sm mb-2">
            {entry.purchase.totalUnits} unidades · Investimento {formatCurrency(entry.purchase.investment)}
          </p>
          <ul className="space-y-1 text-sm text-text-secondary">
            {entry.purchase.products.map((p) => (
              <li key={p.name}>
                {p.quantity}× {p.name}
              </li>
            ))}
          </ul>
        </DiarySection>
      )}

      {entry.sales && (
        <DiarySection title="Vendas">
          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            {entry.sales.paidCount !== undefined && (
              <p>
                <span className="text-text-muted">Pagas:</span> {entry.sales.paidCount}
              </p>
            )}
            {entry.sales.creditCount !== undefined && entry.sales.creditCount > 0 && (
              <p>
                <span className="text-text-muted">Fiadas:</span> {entry.sales.creditCount}
              </p>
            )}
            {entry.sales.fatherSale && (
              <p>
                <span className="text-text-muted">
                  {entry.sales.fatherSale.buyerName ?? "Parceiro"}:
                </span>{" "}
                {entry.sales.fatherSale.units} un. · {formatCurrency(entry.sales.fatherSale.amount)}
              </p>
            )}
          </div>
        </DiarySection>
      )}

      {entry.observations && (
        <DiarySection title="Observações">
          <p className="text-sm text-text-secondary whitespace-pre-wrap">{entry.observations}</p>
        </DiarySection>
      )}

      {entry.manualInsights && (
        <DiarySection title="Insights manuais">
          <p className="text-sm text-text-secondary whitespace-pre-wrap">{entry.manualInsights}</p>
        </DiarySection>
      )}

      {entry.commercialIntelligence && (
        <DiarySection title="O que aprendemos hoje">
          <ul className="list-disc pl-5 space-y-1 text-sm text-text-secondary mb-3">
            {entry.commercialIntelligence.whatWeLearnedToday.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {entry.commercialIntelligence.conclusion && (
            <p className="text-sm font-medium text-brand-orange">{entry.commercialIntelligence.conclusion}</p>
          )}
        </DiarySection>
      )}

      {entry.productHypotheses && entry.productHypotheses.length > 0 && (
        <DiarySection title="Hipóteses de produto">
          <ul className="space-y-2">
            {entry.productHypotheses.map((h) => (
              <li key={h.flavor} className="text-sm">
                <Badge variant="info" className="mr-2">{h.flavor}</Badge>
                {h.hypothesis}
              </li>
            ))}
          </ul>
        </DiarySection>
      )}

      {entry.suggestedActions && entry.suggestedActions.length > 0 && (
        <DiarySection title="Ações sugeridas">
          {entry.suggestedActions.map((a) => (
            <div key={a.id} className="mb-3 last:mb-0">
              <p className="font-medium text-sm">{a.title}</p>
              <p className="text-xs text-text-muted mt-1">{a.description}</p>
            </div>
          ))}
        </DiarySection>
      )}

      {entry.lessonsLearned && (
        <DiarySection title="Lições aprendidas">
          <p className="text-sm italic text-text-secondary">&ldquo;{entry.lessonsLearned}&rdquo;</p>
        </DiarySection>
      )}
    </div>
  );
}

export default function DiarioPage() {
  const queryClient = useQueryClient();
  const { activeBusinessId, canWrite, withQuery, writeBlockedMessage } = useBusinessScope();
  const selectedDate = useViewDate();
  const setViewDate = useTemporalContextStore((s) => s.setViewDate);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<OperationalDiaryEntry | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const scoped = !isAllBusinesses(activeBusinessId);

  const { data: entry, isLoading } = useQuery<DiaryEntry | null>({
    queryKey: ["diary", activeBusinessId, selectedDate],
    queryFn: async () => {
      const r = await fetch(withQuery(`/api/diary?date=${selectedDate}`));
      if (r.status === 404) return null;
      const json = await r.json();
      if (json?.error) throw new Error(json.error);
      return json;
    },
    enabled: scoped,
  });

  const { data: recent = [] } = useQuery<DiaryEntry[]>({
    queryKey: ["diary-list", activeBusinessId],
    queryFn: () => fetch(withQuery("/api/diary")).then((r) => r.json()),
    enabled: scoped,
  });

  const saveMutation = useMutation({
    mutationFn: (data: OperationalDiaryEntry) =>
      fetch("/api/diary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok || json.error) throw new Error(json.error || "Erro ao salvar.");
        return json;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary"] });
      queryClient.invalidateQueries({ queryKey: ["diary-list"] });
      setEditing(false);
      setSaveError(null);
    },
    onError: (e: Error) => setSaveError(e.message),
  });

  const displayEntry = entry ?? (scoped ? emptyEntry(activeBusinessId, selectedDate) : null);

  function shiftDate(days: number) {
    const d = parseISO(selectedDate);
    d.setDate(d.getDate() + days);
    setViewDate(format(d, "yyyy-MM-dd"));
    setEditing(false);
  }

  function startEdit() {
    if (!canWrite) {
      setSaveError(writeBlockedMessage);
      return;
    }
    setForm(displayEntry ? { ...displayEntry } : emptyEntry(activeBusinessId, selectedDate));
    setEditing(true);
    setSaveError(null);
  }

  if (!scoped) {
    return (
      <AppShell title="Diário Operacional" subtitle="Memória operacional do negócio">
        <BusinessWriteNotice message="Selecione uma operação específica para acessar o diário. Nesta demo a conta começa sem operações — no produto real cada usuário cria as suas." />
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell title="Diário Operacional">
        <PageLoader />
      </AppShell>
    );
  }

  return (
    <ModuleShell
      title="Diário Operacional"
      subtitle={`${getBusinessUnitName(activeBusinessId)} · memória qualitativa`}
      temporalChip={false}
      actions={
        canWrite && !editing ? (
          <Button size="sm" onClick={startEdit}>
            {entry ? "Editar" : "Registrar dia"}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex flex-1 items-center gap-2 sm:flex-none">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => shiftDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setViewDate(e.target.value);
                setEditing(false);
              }}
              className="min-w-0 flex-1 sm:w-auto sm:flex-none"
            />
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => shiftDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm capitalize text-text-muted">
            {format(parseISO(selectedDate), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        {recent.length > 0 && (
          <SectionPanel theme="dashboard" title="Dias registrados">
            <div className="flex flex-wrap gap-2">
              {recent.slice(0, 8).map((d) => (
                <Button
                  key={d.date}
                  variant={d.date === selectedDate ? "default" : "secondary"}
                  size="sm"
                  onClick={() => {
                    setViewDate(d.date);
                    setEditing(false);
                  }}
                >
                  {format(parseISO(d.date), "dd/MM")}
                </Button>
              ))}
            </div>
          </SectionPanel>
        )}

        {!entry && !editing && (
          <Card className="border-dashed p-8 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-text-muted" />
            <p className="text-text-secondary mb-4">Nenhum registro para este dia.</p>
            {canWrite && <Button onClick={startEdit}>Registrar diário</Button>}
          </Card>
        )}

        {entry && !editing && displayEntry && (
          <>
            <DiaryAutoInsightsPanel date={selectedDate} />
            <DiaryView entry={displayEntry} />
          </>
        )}

        {editing && form && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Save className="h-4 w-4" />
                {entry ? "Editar registro" : "Novo registro"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  label="Meta (unidades)"
                  type="number"
                  value={form.dailyGoalUnits ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, dailyGoalUnits: Number(e.target.value) || 0 })
                  }
                />
                <Input
                  label="Receita recebida"
                  type="number"
                  step="0.01"
                  value={form.revenue.received}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      revenue: {
                        ...form.revenue,
                        received: Number(e.target.value),
                        total: Number(e.target.value) + form.revenue.pending,
                      },
                    })
                  }
                />
                <Input
                  label="Receita pendente"
                  type="number"
                  step="0.01"
                  value={form.revenue.pending}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      revenue: {
                        ...form.revenue,
                        pending: Number(e.target.value),
                        total: form.revenue.received + Number(e.target.value),
                      },
                    })
                  }
                />
                <Input
                  label="Lucro"
                  type="number"
                  step="0.01"
                  value={form.profit}
                  onChange={(e) => setForm({ ...form, profit: Number(e.target.value) })}
                />
                <Input
                  label="Qtd. vendida"
                  type="number"
                  value={form.quantitySold}
                  onChange={(e) => setForm({ ...form, quantitySold: Number(e.target.value) })}
                />
                <Input
                  label="Qtd. perdida"
                  type="number"
                  value={form.quantityLost}
                  onChange={(e) => setForm({ ...form, quantityLost: Number(e.target.value) })}
                />
                <Input
                  label="Motivo perda"
                  value={form.lossReason ?? ""}
                  onChange={(e) => setForm({ ...form, lossReason: e.target.value })}
                />
                <Input
                  label="Investimento compra"
                  type="number"
                  step="0.01"
                  value={form.purchase?.investment ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      purchase: {
                        totalUnits: form.purchase?.totalUnits ?? 0,
                        investment: Number(e.target.value),
                        products: form.purchase?.products ?? [],
                      },
                    })
                  }
                />
              </div>
              <Textarea
                label="Observações"
                value={form.observations ?? ""}
                onChange={(e) => setForm({ ...form, observations: e.target.value })}
              />
              <Textarea
                label="Insights manuais"
                value={form.manualInsights ?? ""}
                onChange={(e) => setForm({ ...form, manualInsights: e.target.value })}
              />
              <Textarea
                label="Lições aprendidas"
                value={form.lessonsLearned ?? ""}
                onChange={(e) => setForm({ ...form, lessonsLearned: e.target.value })}
              />
              {saveError && <p className="text-sm text-brand-red">{saveError}</p>}
              {/* Salvar acompanha o rodapé no celular — o formulário é longo. */}
              <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex gap-2 rounded-2xl border border-surface-border bg-surface-base/95 p-2 shadow-lg backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
                <Button
                  size="lg"
                  className="flex-1 sm:flex-none"
                  onClick={() => saveMutation.mutate({ ...form, businessId: activeBusinessId, date: selectedDate })}
                  disabled={saveMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
                <Button size="lg" variant="secondary" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-3 text-xs text-text-muted">
          <p className="flex items-center gap-1">
            <Target className="h-3.5 w-3.5" /> Metas e quantidades
          </p>
          <p className="flex items-center gap-1">
            <Lightbulb className="h-3.5 w-3.5" /> Hipóteses históricas
          </p>
          <p className="flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Preparado para IA futura
          </p>
        </div>
      </div>
    </ModuleShell>
  );
}
