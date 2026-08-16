"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Layers, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ALL_BUSINESSES_ID } from "@/lib/business-units";
import { useBusinessContextStore } from "@/stores/business-context-store";
import { formatCurrency, cn } from "@/lib/utils";
import type { OperationPulse } from "@/lib/visao-geral";

interface OperationCardsProps {
  operations: OperationPulse[];
  consolidated: OperationPulse;
  activeBusinessId: string;
}

function formatLastDate(date: string | null): string {
  if (!date) return "Sem operação registrada";
  return format(new Date(`${date}T12:00:00`), "dd MMM", { locale: ptBR });
}

function OperationCard({
  pulse,
  active,
  index,
  consolidated = false,
  onOpen,
}: {
  pulse: OperationPulse;
  active: boolean;
  index: number;
  consolidated?: boolean;
  onOpen: () => void;
}) {
  const Icon = consolidated ? Layers : Building2;
  const hasData = pulse.revenueMonth > 0 || pulse.profitMonth > 0;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.06, duration: 0.4 }}
      onClick={onOpen}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-2xl border p-4 text-left transition-all sm:p-5",
        "hover:border-brand-yellow/40 hover:shadow-[0_0_32px_rgba(0, 212, 168,0.08)]",
        "active:scale-[0.99]",
        active
          ? "border-brand-yellow/45 bg-gradient-to-br from-brand-yellow/[0.12] via-surface-card to-surface-card"
          : "border-surface-border bg-surface-card/90",
        consolidated && !active && "border-purple-500/20 bg-purple-500/[0.04]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              consolidated ? "bg-purple-500/15 text-purple-300" : "bg-brand-yellow/15 text-brand-yellow",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-bold text-text-primary sm:text-lg">
                {pulse.name}
              </h3>
              {active && (
                <span className="rounded-full bg-brand-yellow/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-yellow">
                  Em foco
                </span>
              )}
            </div>
            <p className="truncate text-xs text-text-muted">{pulse.description}</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-yellow" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Faturamento do mês
          </p>
          <p className="mt-0.5 text-lg font-black tracking-tight text-text-primary sm:text-xl">
            {hasData ? formatCurrency(pulse.revenueMonth) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Lucro do mês
          </p>
          <p className="mt-0.5 text-lg font-black tracking-tight text-brand-green sm:text-xl">
            {hasData ? formatCurrency(pulse.profitMonth) : "—"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-surface-border/80 pt-3 text-[11px] text-text-secondary">
        <span>
          {pulse.operationalDaysMonth > 0
            ? `${pulse.operationalDaysMonth} ${pulse.operationalDaysMonth === 1 ? "dia" : "dias"} no mês`
            : "Sem dias no mês"}
        </span>
        <span className="text-text-muted">·</span>
        <span>
          Último: {formatLastDate(pulse.lastDate)}
          {pulse.lastDayProfit > 0 ? ` · ${formatCurrency(pulse.lastDayProfit)}` : ""}
        </span>
        {pulse.unitsMonth > 0 && (
          <>
            <span className="text-text-muted">·</span>
            <span>{pulse.unitsMonth} un.</span>
          </>
        )}
      </div>
    </motion.button>
  );
}

export function OperationCards({
  operations,
  consolidated,
  activeBusinessId,
}: OperationCardsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setActiveBusiness = useBusinessContextStore((s) => s.setActiveBusiness);

  function openOperation(businessId: string) {
    setActiveBusiness(businessId);
    void queryClient.removeQueries({
      predicate: (q) => {
        const key = q.queryKey[0];
        return key !== "auth" && key !== "businesses" && key !== "visao-geral";
      },
    });
    router.push("/");
  }

  if (operations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-surface-border bg-surface-card/60 px-5 py-10 text-center">
        <Sparkles className="mx-auto mb-3 h-8 w-8 text-text-muted/60" />
        <p className="font-semibold text-text-primary">Nenhuma operação cadastrada</p>
        <p className="mt-1 text-sm text-text-muted">
          Crie sua primeira operação para começar a consultar o hub.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-yellow/80">
            Suas operações
          </p>
          <h2 className="text-lg font-black tracking-tight text-text-primary sm:text-xl">
            Escolha por onde entrar
          </h2>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {operations.map((pulse, index) => (
          <OperationCard
            key={pulse.businessId}
            pulse={pulse}
            active={activeBusinessId === pulse.businessId}
            index={index}
            onOpen={() => openOperation(pulse.businessId)}
          />
        ))}
        <OperationCard
          pulse={consolidated}
          active={activeBusinessId === ALL_BUSINESSES_ID}
          index={operations.length}
          consolidated
          onOpen={() => openOperation(ALL_BUSINESSES_ID)}
        />
      </div>
    </section>
  );
}
