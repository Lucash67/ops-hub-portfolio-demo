"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOBILE_NAV_ITEMS } from "@/constants/navigation";

/**
 * Barra inferior do celular: os quatro destinos de operação mais usados mais o
 * menu completo. Fica fora do fluxo no desktop (lg:hidden).
 */
export function MobileBottomNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-border bg-surface-base/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="Navegação principal"
    >
      <div className="flex items-stretch">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors",
                active ? "text-brand-yellow" : "text-text-muted active:bg-surface-hover",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
              <span className="text-[10px] font-semibold leading-none">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-text-muted transition-colors active:bg-surface-hover"
        >
          <Menu className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          <span className="text-[10px] font-semibold leading-none">Menu</span>
        </button>
      </div>
    </nav>
  );
}
