"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ClipboardPaste,
  Crown,
  FileText,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFirstName, resolveUserTimeZone } from "@/lib/time-greeting";
import { resolveDashboardGreeting } from "@/lib/dashboard-greeting";
import { useSessionUser } from "@/hooks/use-session-user";
import { WeekUnitsPanel } from "@/components/dashboard/week-units-panel";
import type { WeekPulse } from "@/lib/week-pulse";

interface QuickAction {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  primary?: boolean;
}

/** Dia em andamento: o painel é de ação — registrar e movimentar a operação. */
const OPERATE_ACTIONS: QuickAction[] = [
  {
    href: "/registro-dia",
    label: "Registrar o dia",
    hint: "Fechamento e resumo",
    icon: ClipboardPaste,
    primary: true,
  },
  {
    href: "/diario",
    label: "Revisar o dia",
    hint: "Diário operacional",
    icon: BookOpen,
  },
  {
    href: "/vendas",
    label: "Lançar venda",
    hint: "Nova entrada",
    icon: ShoppingCart,
  },
  {
    href: "/financeiro",
    label: "Ver financeiro",
    hint: "Fluxo e caixa",
    icon: Wallet,
  },
  {
    href: "/insights",
    label: "Ver insights",
    hint: "Oportunidades",
    icon: Sparkles,
  },
];

/** Fim de semana ou dia fora de hoje: o painel é de consulta e planejamento. */
const CONSULT_ACTIONS: QuickAction[] = [
  {
    href: "/desempenho",
    label: "Desempenho",
    hint: "Semana fechada",
    icon: TrendingUp,
    primary: true,
  },
  {
    href: "/fechamento",
    label: "Fechamento",
    hint: "Mês e tendência",
    icon: CalendarClock,
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    hint: "Consolidado",
    icon: FileText,
  },
  {
    href: "/insights",
    label: "Ver insights",
    hint: "Oportunidades",
    icon: Sparkles,
  },
  {
    href: "/diario",
    label: "Diário",
    hint: "Dias registrados",
    icon: BookOpen,
  },
];

interface DashboardWelcomeBannerProps {
  className?: string;
  /** Dia em foco no filtro temporal (yyyy-MM-dd) — null na visão geral. */
  viewDate?: string | null;
  /** Resumo da semana para o gráfico de unidades no lugar do card de KPI. */
  weekPulse?: WeekPulse | null;
}

export function DashboardWelcomeBanner({
  className,
  viewDate,
  weekPulse,
}: DashboardWelcomeBannerProps) {
  const { data: user } = useSessionUser();
  const [copy, setCopy] = useState(() => resolveDashboardGreeting({ viewDate }));

  useEffect(() => {
    const timeZone = resolveUserTimeZone();
    const apply = () => setCopy(resolveDashboardGreeting({ viewDate, timeZone }));
    apply();

    const interval = window.setInterval(apply, 60_000);
    return () => window.clearInterval(interval);
  }, [viewDate]);

  const firstName = getFirstName(user?.name ?? "Lucas");
  const quickActions = copy.isConsulting ? CONSULT_ACTIONS : OPERATE_ACTIONS;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative mb-4 overflow-hidden rounded-3xl border border-brand-yellow/20",
        "bg-gradient-to-br from-brand-yellow/[0.09] via-surface-card to-surface-card",
        "p-4 shadow-[0_0_40px_rgba(0, 212, 168,0.06)] sm:p-5",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0, 212, 168,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 168,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <motion.div
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-yellow/12 blur-3xl"
        animate={{ opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-brand-secondary/8 blur-3xl"
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      />

      <div
        className={cn(
          "relative grid gap-4",
          weekPulse ? "lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] lg:items-start" : "",
        )}
      >
        <div className="space-y-3 sm:space-y-3.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-yellow/25 bg-brand-yellow/[0.07] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-yellow">
            <Crown className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            <span>Central de comando</span>
            <Sparkles className="h-3 w-3 shrink-0 opacity-70" />
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <h2 className="text-[1.65rem] font-black leading-[1.12] tracking-tight text-text-primary sm:text-3xl sm:leading-[1.1] lg:text-4xl">
              {copy.greeting},{" "}
              <span className="bg-gradient-to-r from-brand-yellow via-[#5EEAD4] to-brand-secondary bg-clip-text text-transparent">
                {firstName}
              </span>
              .
            </h2>
            <p className="max-w-3xl text-xl font-bold leading-snug text-text-primary sm:text-2xl lg:text-[1.75rem]">
              {copy.headline}
            </p>
            <p className="max-w-3xl text-base text-text-secondary sm:text-lg lg:text-xl">
              {copy.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5 sm:flex sm:overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {quickActions.map((action, index) => {
              const { href, label, hint, icon: Icon, primary } = action;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "group flex flex-col gap-0.5 rounded-2xl border px-3 py-2.5 transition-all duration-200",
                    "sm:min-w-[128px] sm:shrink-0",
                    primary && "col-span-2 sm:col-span-1",
                    primary
                      ? "border-brand-yellow/40 bg-brand-yellow/15 hover:border-brand-yellow/60 hover:bg-brand-yellow/20"
                      : "border-surface-border bg-surface-base/50 hover:border-brand-yellow/30 hover:bg-brand-yellow/[0.06]",
                  )}
                >
                  <motion.span
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + index * 0.04, duration: 0.35 }}
                    className="flex items-center justify-between gap-2"
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg",
                        primary
                          ? "bg-brand-yellow/25 text-brand-yellow"
                          : "bg-surface-hover text-text-secondary",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <ArrowRight
                      className={cn(
                        "h-3.5 w-3.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-70",
                        primary ? "text-brand-yellow" : "text-text-muted",
                      )}
                    />
                  </motion.span>
                  <span
                    className={cn(
                      "text-[13px] font-bold leading-tight",
                      primary ? "text-brand-yellow" : "text-text-primary",
                    )}
                  >
                    {label}
                  </span>
                  <span className="text-[10px] leading-tight text-text-muted">{hint}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {weekPulse && (
          <WeekUnitsPanel pulse={weekPulse} className="lg:sticky lg:top-0" />
        )}
      </div>
    </motion.section>
  );
}
