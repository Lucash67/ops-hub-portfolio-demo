"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, CalendarDays } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  findLastOperationalDate,
  formatContextSelectorLabel,
  type DashboardSale,
} from "@/lib/dashboard-view";
import { withBusinessQuery } from "@/lib/business-units";
import { useActiveBusinessId } from "@/stores/business-context-store";
import {
  useTemporalContextStore,
  useTemporalViewContext,
} from "@/stores/temporal-context-store";

export function DateContextSelector({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const context = useTemporalViewContext();
  const setGeneral = useTemporalContextStore((s) => s.setGeneral);
  const setViewDate = useTemporalContextStore((s) => s.setViewDate);
  const setToday = useTemporalContextStore((s) => s.setToday);
  const setYesterday = useTemporalContextStore((s) => s.setYesterday);
  const setLastOperationalDay = useTemporalContextStore((s) => s.setLastOperationalDay);

  const activeBusinessId = useActiveBusinessId();

  const { data: sales = [] } = useQuery<DashboardSale[]>({
    queryKey: ["sales", activeBusinessId, "date-context"],
    queryFn: async () => {
      const r = await fetch(withBusinessQuery("/api/sales", activeBusinessId));
      const json = await r.json();
      if (!r.ok || json.error || !Array.isArray(json)) return [];
      return json as DashboardSale[];
    },
    // Só busca quando o seletor abre — evita fan-out em toda navegação.
    enabled: open,
    staleTime: 120_000,
  });

  const lastOperational = findLastOperationalDate(sales);
  const label = formatContextSelectorLabel(context);
  const yesterdayISO = format(subDays(new Date(), 1), "yyyy-MM-dd");

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectDate(date: string) {
    setViewDate(date);
    setOpen(false);
    setPickerOpen(false);
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-flex items-center gap-2 text-sm",
        compact && "text-xs",
      )}
    >
      {!compact && <span className="text-text-muted hidden sm:inline">Visualizando:</span>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 border-surface-border bg-surface-elevated/50 font-normal sm:h-8"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <CalendarDays className="h-3.5 w-3.5 text-text-muted" />
        {label}
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-text-muted transition-transform", open && "rotate-180")}
        />
      </Button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 min-w-[240px] rounded-xl border border-surface-border bg-surface-elevated py-1 shadow-lg sm:left-0 sm:right-auto"
          role="listbox"
        >
          <MenuItem
            onClick={() => {
              setGeneral();
              setOpen(false);
            }}
            active={context.mode === "general"}
          >
            Geral
          </MenuItem>
          <div className="my-1 border-t border-surface-border" />
          <MenuItem
            onClick={() => {
              setToday();
              setOpen(false);
            }}
            active={context.mode === "day" && label === "Hoje"}
          >
            Hoje
          </MenuItem>
          <MenuItem
            onClick={() => {
              setYesterday();
              setOpen(false);
            }}
            active={context.mode === "day" && context.viewDate === yesterdayISO}
          >
            Ontem
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (lastOperational) {
                setLastOperationalDay(lastOperational);
                setOpen(false);
              }
            }}
            disabled={!lastOperational}
            active={context.mode === "day" && context.viewDate === lastOperational}
          >
            Último dia operacional
            {lastOperational && (
              <span className="ml-1 text-text-muted">
                ({format(parseISO(lastOperational), "dd/MM", { locale: ptBR })})
              </span>
            )}
          </MenuItem>
          <div className="my-1 border-t border-surface-border" />
          <MenuItem onClick={() => setPickerOpen((v) => !v)}>Selecionar data...</MenuItem>
          {pickerOpen && (
            <div className="border-t border-surface-border px-3 py-2">
              <input
                type="date"
                value={context.mode === "day" ? context.viewDate : ""}
                onChange={(e) => {
                  if (e.target.value) selectDate(e.target.value);
                }}
                className="h-11 w-full rounded-lg border border-surface-border bg-surface-base px-2 py-1.5 text-base text-text-primary sm:h-auto sm:text-sm"
              />
            </div>
          )}
          <MenuItem disabled>Selecionar período...</MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-[44px] w-full items-center px-3 py-2 text-left text-sm transition-colors sm:min-h-0",
        disabled && "cursor-not-allowed opacity-40",
        !disabled && "hover:bg-surface-hover text-text-secondary hover:text-text-primary",
        active && !disabled && "text-brand-orange",
      )}
    >
      {children}
    </button>
  );
}
