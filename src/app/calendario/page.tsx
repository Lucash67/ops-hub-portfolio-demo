"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ModuleShell } from "@/components/layout/module-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/loading";
import { ExecutiveSummary } from "@/components/executive/executive-summary";
import { SectionPanel } from "@/components/executive/section-panel";
import { ChevronLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import { useTemporalContextStore, useViewDate } from "@/stores/temporal-context-store";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";
import { format, getDaysInMonth, parseISO, startOfMonth, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CalendarData {
  dayData: Record<string, { revenue: number; status: "hit" | "close" | "miss" }>;
  target: number;
}

interface DayReport {
  date: string;
  revenue: number;
  profit: number;
  itemsSold: number;
  salesCount: number;
  averageTicket: number;
}

const statusColors = {
  hit: "bg-brand-green",
  close: "bg-yellow-500",
  miss: "bg-brand-red",
};

const statusLabels = {
  hit: "Meta batida",
  close: "Próximo da meta",
  miss: "Meta não atingida",
};

export default function CalendarioPage() {
  const router = useRouter();
  const viewDate = useViewDate();
  const setViewDate = useTemporalContextStore((s) => s.setViewDate);
  const { activeBusinessId, withQuery } = useBusinessScope();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(viewDate);

  // Mantém o painel do dia alinhado ao seletor temporal do header.
  useEffect(() => {
    setSelectedDate(viewDate);
    const parsed = parseISO(viewDate);
    if (!Number.isNaN(parsed.getTime())) {
      setCurrentDate(parsed);
    }
  }, [viewDate]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data: calendar, isLoading, isError, error, refetch } = useQuery<CalendarData>({
    queryKey: ["calendar", year, month, activeBusinessId],
    queryFn: async () => {
      const r = await fetch(withQuery(`/api/calendar?year=${year}&month=${month}`));
      const json = await r.json();
      if (!r.ok || json.error) throw new Error(json.error || "Não foi possível carregar o calendário.");
      return json;
    },
    staleTime: 120_000,
  });

  const { data: dayReport, isLoading: dayReportLoading } = useQuery<DayReport>({
    queryKey: ["day-report", selectedDate, activeBusinessId],
    queryFn: async () => {
      const r = await fetch(withQuery(`/api/calendar?date=${selectedDate}`));
      const json = await r.json();
      if (!r.ok || json.error) throw new Error(json.error || "Não foi possível carregar o dia.");
      return json;
    },
    enabled: !!selectedDate,
    staleTime: 120_000,
  });

  // Garante que o painel lateral só usa dados do dia efetivamente selecionado.
  const matchedDayReport =
    dayReport && selectedDate && dayReport.date === selectedDate ? dayReport : null;

  const daySummary = useMemo(() => {
    if (!matchedDayReport || !calendar) return null;
    const pct = calendar.target > 0 ? (matchedDayReport.revenue / calendar.target) * 100 : 0;
    const status = calendar.dayData[matchedDayReport.date]?.status;

    let conclusion: string;
    if (matchedDayReport.salesCount === 0) {
      conclusion = "Nenhuma venda registrada neste dia.";
    } else if (status === "hit") {
      conclusion = `Meta batida com ${formatPercent(pct)} de aproveitamento. ${matchedDayReport.salesCount} vendas e ticket médio de ${formatCurrency(matchedDayReport.averageTicket)}.`;
    } else if (status === "close") {
      conclusion = `Próximo da meta (${formatPercent(pct)}). Faltaram ${formatCurrency(Math.max(calendar.target - matchedDayReport.revenue, 0))} para atingir o objetivo.`;
    } else {
      conclusion = `Meta não atingida — ${formatCurrency(matchedDayReport.revenue)} de ${formatCurrency(calendar.target)}. Revise produção e horários.`;
    }

    return { pct, conclusion };
  }, [matchedDayReport, calendar]);

  if (isError) {
    return (
      <ModuleShell title="Calendário" subtitle="Metas e desempenho diário">
        <p className="text-text-muted mb-3">
          {error instanceof Error ? error.message : "Não foi possível carregar o calendário."}
        </p>
        <button type="button" className="text-sm text-brand-orange underline" onClick={() => void refetch()}>
          Tentar novamente
        </button>
      </ModuleShell>
    );
  }

  if (isLoading || !calendar) {
    return (
      <ModuleShell title="Calendário" subtitle="Metas e desempenho diário">
        <PageLoader />
      </ModuleShell>
    );
  }

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfWeek = getDay(startOfMonth(currentDate));
  const monthName = format(currentDate, "MMMM yyyy", { locale: ptBR });

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <ModuleShell title="Calendário" subtitle="Metas e desempenho diário">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(year, month - 2, 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold capitalize">{monthName}</h2>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(year, month, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          {Object.entries(statusLabels).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2 text-xs text-text-secondary">
              <div className={`h-2.5 w-2.5 rounded-full ${statusColors[key as keyof typeof statusColors]}`} />
              {label}
            </div>
          ))}
          <div className="text-xs text-text-muted">Meta diária: {formatCurrency(calendar.target)}</div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <SectionPanel theme="goals" title="Calendário" className="lg:col-span-2">
            <Card>
              <CardContent className="pt-5">
                <div className="mb-2 grid grid-cols-7 gap-1 sm:gap-1.5">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                    <div key={d} className="py-1.5 text-center text-[11px] font-medium text-text-muted">
                      <span className="sm:hidden">{d.charAt(0)}</span>
                      <span className="hidden sm:inline">{d}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {days.map((day, i) => {
                    if (day === null) return <div key={`empty-${i}`} />;
                    const dateStr = format(new Date(year, month - 1, day), "yyyy-MM-dd");
                    const dayInfo = calendar.dayData[dateStr];
                    const status = dayInfo?.status ?? "miss";
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setSelectedDate(dateStr);
                          setViewDate(dateStr);
                        }}
                        className={`relative flex min-h-[52px] flex-col items-center justify-center rounded-xl p-1 transition-all hover:scale-[1.03] sm:min-h-[64px] sm:p-2 ${
                          selectedDate === dateStr ? "ring-2 ring-purple-400 bg-purple-500/5" : "bg-surface-elevated"
                        }`}
                      >
                        <span className="text-sm font-semibold">{day}</span>
                        {dayInfo && (
                          <>
                            <div className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full sm:right-1.5 sm:top-1.5 ${statusColors[status]}`} />
                            {/* Receita em 9px é ilegível no celular: só do sm pra cima. */}
                            <span className="mt-0.5 hidden text-[10px] text-text-muted sm:inline">
                              {formatCurrency(dayInfo.revenue)}
                            </span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </SectionPanel>

          <div>
            {matchedDayReport && daySummary ? (
              <div className="space-y-4">
                <ExecutiveSummary
                  theme="goals"
                  title={formatDate(selectedDate!)}
                  conclusion={daySummary.conclusion}
                  items={[
                    { label: "Receita", value: formatCurrency(matchedDayReport.revenue), highlight: true },
                    { label: "Vendas", value: String(matchedDayReport.salesCount) },
                    { label: "Itens", value: String(matchedDayReport.itemsSold) },
                    {
                      label: "Meta",
                      value: calendar.target > 0 ? formatPercent(daySummary.pct) : "—",
                      highlight: daySummary.pct >= 100,
                    },
                  ]}
                />
                <Card className="border-purple-500/20">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-surface-elevated p-3">
                        <p className="label-upper">Lucro</p>
                        <p className="font-bold text-brand-green">{formatCurrency(matchedDayReport.profit)}</p>
                      </div>
                      <div className="rounded-lg bg-surface-elevated p-3">
                        <p className="label-upper">Clientes</p>
                        <p className="font-bold">{matchedDayReport.salesCount}</p>
                      </div>
                      <div className="col-span-2 rounded-lg bg-surface-elevated p-3">
                        <p className="label-upper">Ticket médio</p>
                        <p className="font-bold">{formatCurrency(matchedDayReport.averageTicket)}</p>
                      </div>
                    </div>
                    {matchedDayReport.salesCount > 0 && selectedDate && (
                      <Button
                        className="mt-4 w-full"
                        onClick={() => {
                          setViewDate(selectedDate);
                          router.push("/");
                        }}
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Ver no Dashboard
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="flex h-64 items-center justify-center border-dashed border-purple-500/20">
                <p className="text-sm text-text-muted">
                  {dayReportLoading || (selectedDate && !matchedDayReport)
                    ? "Carregando resumo do dia…"
                    : "Selecione um dia para ver o resumo"}
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
