"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ChevronRight, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  APP_TAGLINE,
  NAV_PINNED_BOTTOM,
  NAV_PINNED_TOP,
  NAV_SECTORS,
  type NavItem,
  type NavSectorId,
} from "@/constants/navigation";
import { BusinessContextSelector } from "@/components/dashboard/business-context-selector";
import { LhHoldingIcon } from "@/components/hub/lh-hub-logo";
import { resolveTheme, THEME_META } from "@/lib/theme-config";
import { clearHubSession } from "@/lib/hub-session";
import { useBusinessContextStore } from "@/stores/business-context-store";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

interface SidebarProps {
  /** Estado do drawer no celular. No desktop a barra é sempre visível. */
  open?: boolean;
  onClose?: () => void;
}

const EXPANDED_KEY = "lbo-nav-sectors-expanded";

function visibleItems(items: NavItem[]) {
  return items.filter((item) => !item.paused);
}

function isHrefActive(pathname: string, href: string) {
  return pathname === href;
}

function sectorContainsPath(pathname: string, items: NavItem[]) {
  return visibleItems(items).some((item) => isHrefActive(pathname, item.href));
}

function readExpanded(): Partial<Record<NavSectorId, boolean>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<NavSectorId, boolean>>;
  } catch {
    return {};
  }
}

function NavLink({
  item,
  active,
  onNavigate,
  nested,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group flex min-h-[44px] items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 lg:min-h-0 lg:text-[13px]",
        nested ? "px-2.5 pl-3" : "px-3",
        active &&
          "bg-brand-yellow/10 text-brand-yellow shadow-[inset_0_0_0_1px_rgba(0, 212, 168,0.18),0_0_20px_rgba(0, 212, 168,0.06)]",
        !active && "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
      <span className="flex-1 truncate">{item.label}</span>
      {active && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-yellow shadow-[0_0_8px_rgba(0, 212, 168,0.7)]" />
      )}
    </Link>
  );
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [expanded, setExpanded] = useState<Partial<Record<NavSectorId, boolean>>>({});
  const resetBusinessContext = useBusinessContextStore((s) => s.resetBusinessContext);

  const activeSectorId = useMemo(() => {
    for (const sector of NAV_SECTORS) {
      if (sectorContainsPath(pathname, sector.items)) return sector.id;
    }
    return null;
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
    const stored = readExpanded();
    setExpanded(() => {
      const next: Partial<Record<NavSectorId, boolean>> = { ...stored };
      if (Object.keys(stored).length === 0) next.operate = true;
      return next;
    });
  }, []);

  // Mantém aberto o setor da página atual (sem fechar os outros).
  useEffect(() => {
    if (!activeSectorId) return;
    setExpanded((prev) =>
      prev[activeSectorId] ? prev : { ...prev, [activeSectorId]: true },
    );
  }, [activeSectorId]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify(expanded));
    } catch {
      /* ignore */
    }
  }, [expanded, mounted]);

  function toggleSector(id: NavSectorId) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      clearHubSession();
      resetBusinessContext(null);
      queryClient.clear();
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const current = resolveTheme(theme);
  const themeMeta = THEME_META[current];
  const ThemeIcon = themeMeta.icon;
  const isBrand = current === "brand";

  return (
    <aside
      aria-hidden={!open ? undefined : false}
      className={cn(
        "fixed left-0 top-0 z-50 flex h-[100dvh] w-[280px] max-w-[86vw] flex-col border-r border-surface-border bg-surface-base",
        "transition-transform duration-300 ease-out will-change-transform",
        "lg:z-40 lg:w-60 lg:max-w-none lg:translate-x-0 lg:transition-none",
        open ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        isBrand && "brand-sidebar",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <LhHoldingIcon height={36} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight text-text-primary">
            LH <span className="text-brand-yellow">Hub</span>
          </p>
          <p className="truncate text-[10px] uppercase tracking-wider text-text-muted">{APP_TAGLINE}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar menu"
          className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors active:bg-surface-hover lg:hidden"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      <div className="border-b border-surface-border">
        <BusinessContextSelector variant="sidebar" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {visibleItems(NAV_PINNED_TOP).map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isHrefActive(pathname, item.href)}
            onNavigate={onClose}
          />
        ))}

        <div className="space-y-1 pt-1">
          {NAV_SECTORS.map((sector) => {
            const items = visibleItems(sector.items);
            if (items.length === 0) return null;
            const isOpen = Boolean(expanded[sector.id]);
            const sectorActive = sectorContainsPath(pathname, sector.items);

            return (
              <div key={sector.id} className="rounded-lg">
                <button
                  type="button"
                  onClick={() => toggleSector(sector.id)}
                  aria-expanded={isOpen}
                  className={cn(
                    "flex min-h-[40px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors lg:min-h-0",
                    sectorActive
                      ? "text-text-primary"
                      : "text-text-muted hover:bg-surface-hover hover:text-text-secondary",
                  )}
                >
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                      isOpen && "rotate-90",
                    )}
                    strokeWidth={2.25}
                  />
                  <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.14em]">
                    {sector.label}
                  </span>
                  <span className="text-[10px] font-medium tabular-nums text-text-muted/80">
                    {items.length}
                  </span>
                </button>

                {isOpen && (
                  <div className="mb-1 ml-2 space-y-0.5 border-l border-surface-border pl-1.5">
                    {items.map((item) => (
                      <NavLink
                        key={item.href}
                        item={item}
                        nested
                        active={isHrefActive(pathname, item.href)}
                        onNavigate={onClose}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-0.5 border-t border-surface-border pt-2">
          {visibleItems(NAV_PINNED_BOTTOM).map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isHrefActive(pathname, item.href)}
              onNavigate={onClose}
            />
          ))}
        </div>
      </nav>

      <div className="space-y-0.5 border-t border-surface-border px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => mounted && setTheme(themeMeta.next)}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary lg:min-h-0 lg:text-[13px]"
        >
          <ThemeIcon className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {themeMeta.label}
        </button>
        <button
          type="button"
          disabled={loggingOut}
          onClick={handleLogout}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-50 lg:min-h-0 lg:text-[13px]"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
          Sair
        </button>
      </div>
    </aside>
  );
}
