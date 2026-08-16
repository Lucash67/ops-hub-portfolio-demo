"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { SYSTEM_PILLARS } from "@/lib/visao-geral";
import { cn } from "@/lib/utils";

export function SystemMap() {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
          Mapa do sistema
        </p>
        <h2 className="text-lg font-black tracking-tight text-text-primary sm:text-xl">
          Principais funções do LH Hub
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Tudo o que o sistema faz, organizado por missão — toque para abrir.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {SYSTEM_PILLARS.map((pillar, pillarIndex) => (
          <motion.div
            key={pillar.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + pillarIndex * 0.05, duration: 0.4 }}
            className={cn(
              "rounded-2xl border bg-surface-card/80 p-4 sm:p-5",
              pillar.border,
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className={cn("text-sm font-bold", pillar.accent)}>{pillar.title}</h3>
                <p className="text-xs text-text-muted">{pillar.subtitle}</p>
              </div>
              <span className={cn("rounded-lg px-2 py-1 text-[10px] font-bold", pillar.accentDim, pillar.accent)}>
                {pillar.modules.length}
              </span>
            </div>

            <ul className="space-y-1.5">
              {pillar.modules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <li key={mod.href}>
                    <Link
                      href={mod.href}
                      className={cn(
                        "group flex min-h-[48px] items-center gap-3 rounded-xl border px-3 py-2 transition-colors",
                        mod.primary
                          ? "border-surface-border/80 bg-surface-elevated/60 hover:border-brand-yellow/35"
                          : "border-transparent hover:border-surface-border hover:bg-surface-elevated/50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          pillar.accentDim,
                          pillar.accent,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-text-primary">
                          {mod.label}
                        </span>
                        <span className="block truncate text-[11px] text-text-muted">
                          {mod.hint}
                        </span>
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
