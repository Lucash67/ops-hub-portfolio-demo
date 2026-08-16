"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { format, parseISO } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  currentWeekStart,
  neighboringWeekStarts,
  weekDropId,
  weekLabel,
  weekRangeFromStart,
} from "@/lib/sticky-notes/week-board";

interface WeekPickerProps {
  weekStart: string;
  onChange: (weekStart: string) => void;
  className?: string;
  /** Destaca as setas como alvos de soltura (arrastar nota entre semanas). */
  weekDropActive?: boolean;
}

function WeekNavButton({
  targetWeekStart,
  label,
  onNavigate,
  dropActive,
  children,
}: {
  targetWeekStart: string;
  label: string;
  onNavigate: () => void;
  dropActive?: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: weekDropId(targetWeekStart),
    data: { type: "week", weekStart: targetWeekStart },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-label={label}
      title={
        dropActive
          ? `${label} — solte a nota aqui para mover`
          : label
      }
      onClick={onNavigate}
      className={cn(
        "flex h-full items-center px-2.5 text-[#e8eaed]/70 transition hover:bg-white/5 hover:text-[#e8eaed]",
        dropActive && "ring-1 ring-inset ring-brand-yellow/35",
        isOver && "bg-brand-yellow/25 text-brand-yellow",
      )}
    >
      {children}
    </button>
  );
}

export function WeekPicker({
  weekStart,
  onChange,
  className,
  weekDropActive = false,
}: WeekPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const range = useMemo(() => weekRangeFromStart(weekStart), [weekStart]);
  const label = weekLabel(range.start, range.end);
  const isCurrent = weekStart === currentWeekStart();
  const prevWeek = neighboringWeekStarts(weekStart, -1);
  const nextWeek = neighboringWeekStarts(weekStart, 1);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div
        className={cn(
          "inline-flex h-11 items-center rounded-lg border bg-[#202124]",
          weekDropActive ? "border-brand-yellow/45" : "border-[#5f6368]/40",
        )}
      >
        <WeekNavButton
          targetWeekStart={prevWeek}
          label="Semana anterior"
          onNavigate={() => onChange(prevWeek)}
          dropActive={weekDropActive}
        >
          <ChevronLeft className="h-4 w-4" />
        </WeekNavButton>

        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="flex min-w-0 max-w-[min(52vw,220px)] items-center gap-1.5 px-2 text-sm font-medium text-[#e8eaed] sm:max-w-none sm:gap-2"
          title="Escolher semana"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-brand-yellow" />
          <span className="truncate">{label}</span>
        </button>

        <WeekNavButton
          targetWeekStart={nextWeek}
          label="Próxima semana"
          onNavigate={() => onChange(nextWeek)}
          dropActive={weekDropActive}
        >
          <ChevronRight className="h-4 w-4" />
        </WeekNavButton>
      </div>

      {!isCurrent && (
        <button
          type="button"
          onClick={() => onChange(currentWeekStart())}
          className="h-11 rounded-lg border border-[#5f6368]/40 bg-[#202124] px-3 text-sm text-[#e8eaed]/75 transition hover:bg-[#28292c] hover:text-[#e8eaed]"
        >
          Esta semana
        </button>
      )}

      {pickerOpen && (
        <div className="relative">
          <div className="absolute left-0 top-0 z-30 w-[260px] rounded-xl border border-[#5f6368]/45 bg-[#2d2e30] p-3 shadow-2xl sm:left-auto sm:right-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#e8eaed]/45">
              Ir para a semana de
            </p>
            <input
              type="date"
              value={range.start}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                onChange(weekRangeFromStart(value).start);
                setPickerOpen(false);
              }}
              className="h-10 w-full rounded-lg border border-[#5f6368]/50 bg-[#202124] px-2 text-sm text-[#e8eaed] focus:border-brand-yellow/50 focus:outline-none"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-[#e8eaed]/45">
              Escolha qualquer dia — o board abre a semana completa (segunda a domingo), ex.:{" "}
              {format(parseISO("2026-08-10"), "dd/MM")} – {format(parseISO("2026-08-16"), "dd/MM")}.
            </p>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="mt-2 w-full rounded-lg py-1.5 text-xs text-[#e8eaed]/50 hover:bg-white/5"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
