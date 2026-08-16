/**
 * Filtros reutilizáveis para o Contexto Temporal (Geral / Dia).
 */
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TemporalViewContext } from "@/stores/temporal-context-store";
import { isOperationalDay } from "@/lib/operational-calendar";

export interface DatedRow {
  date: string;
}

export function filterByTemporalContext<T extends DatedRow>(
  rows: T[],
  context: TemporalViewContext,
): T[] {
  if (context.mode === "general") return rows;
  return rows.filter((r) => r.date === context.viewDate);
}

export function filterUpToDate<T extends DatedRow>(
  rows: T[],
  context: TemporalViewContext,
): T[] {
  if (context.mode === "general") return rows;
  return rows.filter((r) => r.date <= context.viewDate);
}

export function previousOperationalDate(
  date: string,
  businessId: string,
  knownDates: string[],
): string | null {
  const sorted = Array.from(new Set(knownDates))
    .filter((d) => d < date && isOperationalDay(d, businessId))
    .sort();
  return sorted.length > 0 ? sorted[sorted.length - 1]! : null;
}

export function formatTemporalFilterSubtitle(context: TemporalViewContext): string {
  if (context.mode === "general") {
    return "Visão geral · histórico completo";
  }
  const label = format(parseISO(context.viewDate), "EEEE, dd/MM/yyyy", { locale: ptBR });
  return `Dia selecionado · ${label}`;
}

export function temporalQueryParams(context: TemporalViewContext): Record<string, string> {
  if (context.mode === "general") return {};
  return { date: context.viewDate, viewMode: "day" };
}

/** Rotas que não exibem o seletor temporal global. */
export const TEMPORAL_FILTER_EXCLUDED_PATHS = [
  "/configuracoes",
  "/registro-dia",
  "/fechamento",
  "/visao-geral",
  "/notas",
  "/dev",
] as const;

export function shouldShowTemporalFilter(pathname: string): boolean {
  return !TEMPORAL_FILTER_EXCLUDED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
