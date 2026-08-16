"use client";

import { useState, useMemo } from "react";
import { SectionPanel } from "@/components/executive/section-panel";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { simulateExtraUnits } from "@/lib/smart-goals-view";
import { Calculator } from "lucide-react";

interface GoalSimulatorProps {
  currentUnits: number;
  targetUnits: number;
  avgUnitPrice: number;
  avgUnitProfit: number;
}

export function GoalSimulator({
  currentUnits,
  targetUnits,
  avgUnitPrice,
  avgUnitProfit,
}: GoalSimulatorProps) {
  const [extraUnits, setExtraUnits] = useState(2);

  const result = useMemo(
    () => simulateExtraUnits(extraUnits, currentUnits, targetUnits, avgUnitPrice, avgUnitProfit),
    [extraUnits, currentUnits, targetUnits, avgUnitPrice, avgUnitProfit],
  );

  return (
    <SectionPanel theme="goals" title="Simulador" subtitle="Projeção sem alterar dados reais">
      <div className="rounded-2xl border border-purple-500/20 bg-surface-card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Calculator className="h-4 w-4 text-purple-400" />
          <span className="text-sm text-text-secondary">Se vender mais unidades hoje:</span>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-text-muted">+</span>
          <Input
            type="number"
            min={0}
            max={50}
            value={extraUnits}
            onChange={(e) => setExtraUnits(Math.max(0, Number(e.target.value) || 0))}
            className="w-24 text-center"
          />
          <span className="text-sm text-text-muted">unidades</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-text-muted text-xs">Receita prevista</p>
            <p className="font-semibold text-text-primary">{formatCurrency(result.projectedRevenue)}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs">Lucro previsto</p>
            <p className="font-semibold text-brand-green">{formatCurrency(result.projectedProfit)}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs">Total projetado</p>
            <p className="font-semibold text-text-primary">{result.projectedTotalUnits} un.</p>
          </div>
          <div>
            <p className="text-text-muted text-xs">Meta atingida?</p>
            <p className={`font-semibold ${result.wouldHitDailyGoal ? "text-brand-green" : "text-brand-orange"}`}>
              {result.wouldHitDailyGoal ? "Sim" : "Não"}
            </p>
          </div>
        </div>
      </div>
    </SectionPanel>
  );
}
