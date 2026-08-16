"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { getFirstName, resolveUserTimeZone } from "@/lib/time-greeting";
import { resolveVisaoGeralGreeting } from "@/lib/visao-geral";
import { useSessionUser } from "@/hooks/use-session-user";
import { cn } from "@/lib/utils";

interface VisaoGeralHeroProps {
  operationCount: number;
  className?: string;
}

export function VisaoGeralHero({ operationCount, className }: VisaoGeralHeroProps) {
  const { data: user } = useSessionUser();
  const firstName = getFirstName(user?.name ?? "Lucas");
  const [copy, setCopy] = useState(() =>
    resolveVisaoGeralGreeting(firstName, resolveUserTimeZone()),
  );

  useEffect(() => {
    setCopy(resolveVisaoGeralGreeting(firstName, resolveUserTimeZone()));
  }, [firstName]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-brand-yellow/20 bg-gradient-to-br from-brand-yellow/[0.08] via-surface-card to-surface-card p-5 sm:p-7",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-yellow/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-10 h-48 w-48 rounded-full bg-brand-orange/10 blur-3xl"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-yellow/25 bg-brand-yellow/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-yellow">
          <Crown className="h-3.5 w-3.5" />
          Visão Geral · Ops Hub
        </div>
        <p className="text-xs text-text-muted">
          {operationCount === 0
            ? "Nenhuma operação ainda"
            : `${operationCount} ${operationCount === 1 ? "operação ativa" : "operações ativas"}`}
        </p>
      </div>

      <h1 className="relative mt-4 max-w-3xl text-2xl font-black leading-[1.15] tracking-tight text-text-primary sm:text-3xl lg:text-[2.15rem]">
        {copy.greeting},{" "}
        <span className="bg-gradient-to-r from-brand-yellow via-[#5EEAD4] to-brand-orange bg-clip-text text-transparent">
          {firstName}
        </span>
        , deseja consultar qual de suas operações hoje?
      </h1>

      <p className="relative mt-3 max-w-2xl text-sm text-text-secondary sm:text-base">
        {copy.subtitle}
      </p>
    </motion.section>
  );
}
