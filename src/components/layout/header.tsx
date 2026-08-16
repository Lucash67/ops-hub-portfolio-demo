"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  brandHeader?: boolean;
  onOpenMenu?: () => void;
}

export function Header({ title, subtitle, actions, brandHeader, onOpenMenu }: HeaderProps) {
  const today = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-surface-border bg-surface-base/95 backdrop-blur-sm",
        brandHeader && "brand-header",
      )}
    >
      <div className="flex min-h-[56px] flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 sm:px-5 lg:min-h-[64px] lg:px-6 lg:py-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menu"
          className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors active:bg-surface-hover lg:hidden"
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight text-text-primary sm:text-xl">
            {title}
          </h1>
          <div className="truncate text-xs capitalize text-text-muted sm:mt-0.5 sm:text-sm">
            {subtitle ?? <span>{today}</span>}
          </div>
        </div>

        {actions && (
          // No celular as ações ganham a própria linha e quebram em duas se
          // preciso — sem rolagem, que cortaria os dropdowns abertos.
          <div className="order-last flex w-full flex-wrap items-center gap-2 sm:order-none sm:w-auto sm:flex-nowrap sm:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
