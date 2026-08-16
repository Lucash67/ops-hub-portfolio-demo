"use client";

import { motion } from "framer-motion";
import { DollarSign, Target, TrendingUp, Users } from "lucide-react";
import { PulseMetric } from "@/components/dashboard/pulse-metric";
import { TopProductsCard, ChartCard } from "@/components/charts/chart-card";
import { formatCurrency } from "@/lib/utils";

interface DashboardGeneralViewProps {
  revenue: number;
  profit: number;
  goalProgress: number;
  itemsSold: number;
  uniqueBuyers: number;
  flavors: Array<{ label: string; value: number }>;
  payments: Array<{ label: string; value: number }>;
}

export function DashboardGeneralView({
  revenue,
  profit,
  goalProgress,
  itemsSold,
  uniqueBuyers,
  flavors,
  payments,
}: DashboardGeneralViewProps) {
  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-blue-500/25 bg-gradient-to-br from-blue-500/10 via-surface-card to-purple-500/10 p-4 sm:p-8"
      >
        <p className="mb-1 text-sm text-text-secondary">Visão executiva · histórico completo</p>
        <p className="text-[2rem] font-black tracking-tight text-blue-400 sm:text-4xl lg:text-5xl">
          {formatCurrency(revenue)}
        </p>
        <p className="mt-2 text-sm text-text-secondary sm:text-base">
          Lucro acumulado{" "}
          <span className="text-emerald-400 font-bold">{formatCurrency(profit)}</span>
          {" · "}
          {itemsSold} unidades · {uniqueBuyers} compradores
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <PulseMetric label="Receita total" value={revenue} icon={DollarSign} variant="revenue" delay={0} />
        <PulseMetric
          label="Lucro total"
          value={profit}
          icon={TrendingUp}
          variant="gain"
          delay={1}
        />
        <PulseMetric
          label="Meta geral"
          value={goalProgress}
          format="percent"
          icon={Target}
          variant="meta"
          delay={2}
        />
        <PulseMetric
          label="Compradores"
          value={uniqueBuyers}
          format="number"
          icon={Users}
          variant="info"
          subtext={`${itemsSold} un. no histórico`}
          delay={3}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TopProductsCard products={flavors} subtitle="Histórico completo" />
        <ChartCard
          data={payments.filter((p) => p.value > 0)}
          title="Como pagaram"
          subtitle="Histórico"
          type="pie"
          height={220}
        />
      </div>
    </div>
  );
}
