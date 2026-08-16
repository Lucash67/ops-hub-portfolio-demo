import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { StickyNote } from "./types";

export const UNDATED_COLUMN_ID = "undated";
export const WEEK_DROP_PREFIX = "week:";

export function weekDropId(weekStart: string): string {
  return `${WEEK_DROP_PREFIX}${weekStart}`;
}

export function parseWeekDropId(id: string): string | null {
  if (!id.startsWith(WEEK_DROP_PREFIX)) return null;
  return id.slice(WEEK_DROP_PREFIX.length) || null;
}

/**
 * Preserva o dia da semana ao mudar de semana (terça → terça).
 * Sem data → segunda da semana alvo.
 */
export function mapNoteDateToWeek(
  noteDate: string | null | undefined,
  targetWeekStart: string,
): string {
  const { start } = weekRangeFromStart(targetWeekStart);
  if (!noteDate) return start;
  const noteWeekStart = startOfWeek(parseISO(noteDate), { weekStartsOn: 1 });
  const offset = differenceInCalendarDays(parseISO(noteDate), noteWeekStart);
  return format(addDays(parseISO(start), Math.min(Math.max(offset, 0), 6)), "yyyy-MM-dd");
}

export interface WeekColumn {
  id: string;
  /**
   * Data alvo ao soltar na coluna (yyyy-MM-dd).
   * Em board por dia = o próprio dia; null = Sem data.
   */
  weekStart: string | null;
  weekEnd: string | null;
  label: string;
  notes: StickyNote[];
}

export function weekKeyFromDate(date: string): string {
  const start = startOfWeek(parseISO(date), { weekStartsOn: 1 });
  return format(start, "yyyy-MM-dd");
}

export function weekLabel(weekStart: string, weekEnd: string): string {
  return `Semana ${format(parseISO(weekStart), "dd/MM/yyyy")} – ${format(parseISO(weekEnd), "dd/MM/yyyy")}`;
}

export function formatNoteDateLabel(date: string | null | undefined): string {
  if (!date) return "Sem data";
  return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
}

function sortNotes(list: StickyNote[]): StickyNote[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return b.clientUpdatedAt.localeCompare(a.clientUpdatedAt);
  });
}

/** Rótulo da coluna do dia: "Segunda · 10/08". */
export function dayColumnLabel(date: string): string {
  const d = parseISO(date);
  const raw = format(d, "EEEE", { locale: ptBR }); // segunda-feira
  const short = raw.replace("-feira", "");
  const capped = short.charAt(0).toUpperCase() + short.slice(1);
  return `${capped} · ${format(d, "dd/MM")}`;
}

export function weekRangeFromStart(weekStart: string): { start: string; end: string } {
  const start = format(startOfWeek(parseISO(weekStart), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const end = format(endOfWeek(parseISO(start), { weekStartsOn: 1 }), "yyyy-MM-dd");
  return { start, end };
}

export function currentWeekStart(reference = new Date()): string {
  return format(startOfWeek(reference, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

/**
 * Board da semana focada: uma coluna por dia (seg→dom).
 * Notas sem data ou fora da semana não aparecem neste board.
 */
export function buildDayColumnsForWeek(notes: StickyNote[], weekStart: string): WeekColumn[] {
  const { start, end } = weekRangeFromStart(weekStart);
  const byDay = new Map<string, StickyNote[]>();

  const dayKeys: string[] = [];
  let cursor = parseISO(start);
  for (let i = 0; i < 7; i++) {
    const key = format(cursor, "yyyy-MM-dd");
    dayKeys.push(key);
    byDay.set(key, []);
    cursor = addDays(cursor, 1);
  }

  for (const note of notes) {
    if (!note.noteDate) continue;
    if (note.noteDate < start || note.noteDate > end) continue;
    const list = byDay.get(note.noteDate);
    if (list) list.push(note);
  }

  return dayKeys.map((date) => ({
    id: date,
    weekStart: date,
    weekEnd: date,
    label: dayColumnLabel(date),
    notes: sortNotes(byDay.get(date) ?? []),
  }));
}

/** @deprecated Prefer buildDayColumnsForWeek — mantido para testes/legado. */
export function buildWeekColumns(notes: StickyNote[]): WeekColumn[] {
  const byWeek = new Map<string, StickyNote[]>();
  const undated: StickyNote[] = [];

  for (const note of notes) {
    if (!note.noteDate) {
      undated.push(note);
      continue;
    }
    const key = weekKeyFromDate(note.noteDate);
    const list = byWeek.get(key) ?? [];
    list.push(note);
    byWeek.set(key, list);
  }

  const weekStarts = Array.from(byWeek.keys()).sort((a, b) => b.localeCompare(a));
  const columns: WeekColumn[] = weekStarts.map((start) => {
    const end = format(endOfWeek(parseISO(start), { weekStartsOn: 1 }), "yyyy-MM-dd");
    return {
      id: start,
      weekStart: start,
      weekEnd: end,
      label: weekLabel(start, end),
      notes: sortNotes(byWeek.get(start) ?? []),
    };
  });

  columns.unshift({
    id: UNDATED_COLUMN_ID,
    weekStart: null,
    weekEnd: null,
    label: "Sem data",
    notes: sortNotes(undated),
  });

  return columns;
}

export function ensureWeekColumn(columns: WeekColumn[], weekStart: string): WeekColumn[] {
  const { start, end } = weekRangeFromStart(weekStart);
  if (columns.some((c) => c.id === start)) return columns;
  const column: WeekColumn = {
    id: start,
    weekStart: start,
    weekEnd: end,
    label: weekLabel(start, end),
    notes: [],
  };
  if (columns.length === 0) return [column];
  // Mantém a coluna "sem data" (índice 0) à esquerda quando existir.
  if (columns[0]?.id === UNDATED_COLUMN_ID) {
    return [columns[0], column, ...columns.slice(1)];
  }
  return [column, ...columns];
}

export function ensureCurrentWeekColumn(columns: WeekColumn[]): WeekColumn[] {
  return ensureWeekColumn(columns, currentWeekStart());
}

/** @deprecated Use buildDayColumnsForWeek. */
export function focusWeekColumns(columns: WeekColumn[], weekStart: string): WeekColumn[] {
  const ensured = ensureWeekColumn(columns, weekStart);
  const { start } = weekRangeFromStart(weekStart);
  const undated = ensured.find((c) => c.id === UNDATED_COLUMN_ID);
  const focused = ensured.find((c) => c.id === start);
  return [undated!, focused!].filter(Boolean);
}

export function neighboringWeekStarts(anchor: string, direction: -1 | 1): string {
  const base = parseISO(anchor);
  const next = direction === 1 ? addWeeks(base, 1) : subWeeks(base, 1);
  return format(startOfWeek(next, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

/** Data ao soltar numa coluna (dia ou sem data). */
export function dateForWeekDrop(
  columnDate: string | null,
  _previousDate?: string | null,
): string | null {
  return columnDate;
}
