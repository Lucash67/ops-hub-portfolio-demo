"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ALL_BUSINESSES_ID } from "@/lib/business-units";
import { useOwnedBusinesses } from "@/hooks/use-owned-businesses";
import {
  useActiveBusinessId,
  useBusinessContextStore,
} from "@/stores/business-context-store";

interface BusinessContextSelectorProps {
  variant?: "inline" | "sidebar";
}

export function BusinessContextSelector({ variant = "inline" }: BusinessContextSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const activeBusinessId = useActiveBusinessId();
  const setActiveBusiness = useBusinessContextStore((s) => s.setActiveBusiness);
  const { data, units } = useOwnedBusinesses();

  const options = [
    { id: data?.all.id ?? ALL_BUSINESSES_ID, name: data?.all.name ?? "Todos" },
    ...units,
  ];

  const activeLabel =
    options.find((o) => o.id === activeBusinessId)?.name ??
    (units.length === 0 ? "Nenhuma operação" : "Todos");

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectBusiness(businessId: string) {
    setActiveBusiness(businessId);
    setOpen(false);
    // Remove cached module data so a troca de operação nunca reutiliza KPIs antigos.
    // Mantém auth/businesses aquecidos.
    void queryClient.removeQueries({
      predicate: (q) => {
        const key = q.queryKey[0];
        return key !== "auth" && key !== "businesses";
      },
    });
  }

  const isSidebar = variant === "sidebar";

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative",
        isSidebar ? "w-full px-5 pb-4" : "inline-flex items-center gap-2 text-sm",
      )}
    >
      {isSidebar ? (
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">Operação</p>
      ) : (
        <span className="text-text-muted">Operação:</span>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "gap-1.5 border-surface-border bg-surface-elevated/50 font-normal",
          isSidebar ? "h-11 w-full justify-between px-3 text-sm lg:h-9 lg:text-[13px]" : "sm:h-8",
        )}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex items-center gap-1.5 truncate">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          {activeLabel}
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 text-text-muted transition-transform", open && "rotate-180")}
        />
      </Button>

      {open && (
        <div
          className={cn(
            "absolute z-50 rounded-xl border border-surface-border bg-surface-elevated py-1 shadow-lg",
            isSidebar ? "left-5 right-5 top-full mt-1" : "left-0 top-full mt-2 min-w-[200px]",
          )}
          role="listbox"
        >
          {units.length === 0 ? (
            <p className="px-3 py-2 text-sm text-text-muted">Crie sua primeira operação no painel.</p>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={activeBusinessId === option.id}
                onClick={() => selectBusiness(option.id)}
                className={cn(
                  "flex min-h-[44px] w-full items-center px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary lg:min-h-0",
                  activeBusinessId === option.id && "text-brand-orange",
                )}
              >
                {option.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
