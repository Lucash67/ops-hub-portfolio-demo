"use client";

import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { STICKY_NOTE_COLORS, STICKY_NOTE_COLOR_STYLES, type StickyNoteColor } from "@/lib/sticky-notes/types";

export type NotesDateFilter =
  | "all"
  | "this_week"
  | "last_week"
  | "with_date"
  | "no_date";

export interface NotesFilterState {
  date: NotesDateFilter;
  color: StickyNoteColor | "all";
  pinnedOnly: boolean;
}

export const DEFAULT_NOTES_FILTERS: NotesFilterState = {
  date: "all",
  color: "all",
  pinnedOnly: false,
};

interface NotesFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: NotesFilterState;
  onChange: (filters: NotesFilterState) => void;
}

const DATE_OPTIONS: Array<{ id: NotesDateFilter; label: string }> = [
  { id: "all", label: "Todas as datas" },
  { id: "this_week", label: "Esta semana" },
  { id: "last_week", label: "Semana passada" },
  { id: "with_date", label: "Com data" },
  { id: "no_date", label: "Sem data" },
];

export function NotesFilters({ open, onOpenChange, filters, onChange }: NotesFiltersProps) {
  const activeCount =
    (filters.date !== "all" ? 1 : 0) +
    (filters.color !== "all" ? 1 : 0) +
    (filters.pinnedOnly ? 1 : 0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition",
          open || activeCount > 0
            ? "border-brand-yellow/40 bg-brand-yellow/10 text-brand-yellow"
            : "border-[#5f6368]/40 bg-[#202124] text-[#e8eaed]/80 hover:bg-[#28292c]",
        )}
      >
        <Filter className="h-4 w-4" />
        Filtrar
        {activeCount > 0 && (
          <span className="rounded-full bg-brand-yellow/20 px-1.5 text-[11px] font-bold">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[280px] rounded-xl border border-[#5f6368]/45 bg-[#2d2e30] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[#e8eaed]/50">Filtros</p>
            <button
              type="button"
              title="Limpar"
              onClick={() => onChange(DEFAULT_NOTES_FILTERS)}
              className="text-xs text-[#e8eaed]/55 hover:text-[#e8eaed]"
            >
              Limpar
            </button>
          </div>

          <p className="mb-1.5 text-[11px] font-semibold text-[#e8eaed]/45">Data</p>
          <div className="mb-3 space-y-1">
            {DATE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ ...filters, date: opt.id })}
                className={cn(
                  "flex w-full rounded-lg px-2.5 py-1.5 text-left text-sm",
                  filters.date === opt.id
                    ? "bg-brand-yellow/15 text-brand-yellow"
                    : "text-[#e8eaed]/80 hover:bg-white/5",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <p className="mb-1.5 text-[11px] font-semibold text-[#e8eaed]/45">Cor</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              title="Todas"
              onClick={() => onChange({ ...filters, color: "all" })}
              className={cn(
                "h-7 rounded-full px-2 text-[11px]",
                filters.color === "all"
                  ? "bg-white/15 text-white"
                  : "bg-white/5 text-[#e8eaed]/60",
              )}
            >
              Todas
            </button>
            {STICKY_NOTE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                onClick={() => onChange({ ...filters, color })}
                className={cn(
                  "h-7 w-7 rounded-full",
                  STICKY_NOTE_COLOR_STYLES[color].swatch,
                  filters.color === color && "ring-2 ring-white",
                )}
              />
            ))}
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[#e8eaed]/85 hover:bg-white/5">
            <input
              type="checkbox"
              checked={filters.pinnedOnly}
              onChange={(e) => onChange({ ...filters, pinnedOnly: e.target.checked })}
              className="rounded border-[#5f6368]"
            />
            Somente fixadas
          </label>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs text-[#e8eaed]/50 hover:bg-white/5"
          >
            <X className="h-3.5 w-3.5" /> Fechar
          </button>
        </div>
      )}
    </div>
  );
}
