"use client";

import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { WeekPulse, WeekPulseDay } from "@/lib/week-pulse";

const BAR_TRACK_PX = 56;

/** Dias úteis da semana até o dia em foco (inclusive). Ex.: na quinta → seg–qui. */
function daysThroughFocus(days: WeekPulseDay[]): WeekPulseDay[] {
  const focus = days.find((day) => day.isFocus);
  if (!focus) return days;
  return days.filter((day) => day.date <= focus.date);
}

/** Mini gráfico de unidades vendidas na semana — substitui o card de KPI do banner. */
export function WeekUnitsPanel({
  pulse,
  className,
}: {
  pulse: WeekPulse;
  className?: string;
}) {
  const days = daysThroughFocus(pulse.days);
  const units = days.reduce((total, day) => total + day.units, 0);
  const operationalDays = days.filter((day) => day.units > 0).length;
  const maxUnits = Math.max(...days.map((day) => day.units), 1);
  const rangeLabel =
    days.length > 0
      ? `${format(parseISO(days[0]!.date), "dd/MM")} – ${format(parseISO(days[days.length - 1]!.date), "dd/MM")}`
      : pulse.rangeLabel;

  return (
    <div
      className={cn(
        "rounded-2xl border border-brand-yellow/20 bg-surface-base/70 p-3.5 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
          Vendas na semana
        </p>
        <span className="text-[10px] font-semibold text-text-secondary">{rangeLabel}</span>
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <p className="text-2xl font-black leading-none text-brand-yellow">
          {units}
          <span className="ml-1 text-sm font-bold text-text-secondary">un</span>
        </p>
        <p className="text-[11px] text-text-muted">
          {operationalDays} {operationalDays === 1 ? "dia" : "dias"}
        </p>
      </div>

      <div className="mt-3 flex items-end gap-1.5">
        {days.map((day) => {
          const barPx =
            day.units > 0
              ? Math.max(Math.round((day.units / maxUnits) * BAR_TRACK_PX), 10)
              : 0;
          return (
            <div
              key={day.date}
              title={`${day.label} · ${day.units} un`}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
            >
              <span className="text-[9px] font-bold tabular-nums text-text-secondary">
                {day.units > 0 ? day.units : "—"}
              </span>
              <div
                className="flex w-full items-end rounded-[4px] bg-[#2a2a2a]"
                style={{ height: BAR_TRACK_PX }}
              >
                <div
                  className={cn(
                    "w-full rounded-[4px]",
                    day.isFocus ? "bg-[#00D4A8]" : "bg-[#0D9488]",
                  )}
                  style={{ height: barPx, minHeight: barPx > 0 ? 10 : 0 }}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold capitalize",
                  day.isFocus ? "text-brand-yellow" : "text-text-muted",
                )}
              >
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
