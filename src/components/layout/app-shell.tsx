"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { useTheme } from "next-themes";
import { resolveTheme } from "@/lib/theme-config";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export function AppShell({ children, title, subtitle, actions }: AppShellProps) {
  const { theme } = useTheme();
  const isBrand = resolveTheme(theme) === "brand";
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Navegar fecha o drawer; sem isso o menu fica aberto sobre a página nova.
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className={cn("relative min-h-screen bg-surface-base", isBrand && "brand-shell")}>
      {isBrand && (
        <>
          <div className="brand-ambient brand-ambient-a" aria-hidden />
          <div className="brand-ambient brand-ambient-b" aria-hidden />
          <div className="brand-vignette" aria-hidden />
          <div className="brand-grain" aria-hidden />
        </>
      )}

      <Sidebar open={menuOpen} onClose={closeMenu} />

      {menuOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={closeMenu}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <div className="relative z-[1] lg:pl-60">
        <Header
          title={title}
          subtitle={subtitle}
          actions={actions}
          brandHeader={isBrand}
          onOpenMenu={() => setMenuOpen(true)}
        />
        {/* pb extra no celular: a barra inferior não pode cobrir o conteúdo. */}
        {/* overflow-x-clip (e não hidden) para não criar contexto de scroll e
            manter position: sticky funcionando dentro das páginas. */}
        <main className="overflow-x-clip p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-5 lg:p-6 lg:pb-6">
          {children}
        </main>
      </div>

      <MobileBottomNav onOpenMenu={() => setMenuOpen(true)} />
    </div>
  );
}
