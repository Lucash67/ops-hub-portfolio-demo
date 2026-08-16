/** Simulação client-side — não persiste dados. */

export interface ProfitBankSimulationInput {
  startingBalance: number;
  avgDailyProfit: number;
  saveRatePercent: number;
  monthlyWithdrawal: number;
  horizonDays: number;
  operationalDaysPerWeek?: number;
}

export interface ProfitBankSimulationPoint {
  label: string;
  day: number;
  saved: number;
  withdrawn: number;
  balance: number;
}

export function simulateProfitBank(input: ProfitBankSimulationInput): ProfitBankSimulationPoint[] {
  const {
    startingBalance,
    avgDailyProfit,
    saveRatePercent,
    monthlyWithdrawal,
    horizonDays,
    operationalDaysPerWeek = 5,
  } = input;

  const saveRate = Math.min(100, Math.max(0, saveRatePercent)) / 100;
  const dailySaved = avgDailyProfit * saveRate;
  const withdrawalEvery = Math.round((30 / 7) * operationalDaysPerWeek);

  let balance = startingBalance;
  const points: ProfitBankSimulationPoint[] = [];

  for (let day = 1; day <= horizonDays; day++) {
    let saved = 0;
    let withdrawn = 0;

    const isOpDay = day % 7 <= operationalDaysPerWeek;
    if (isOpDay) {
      saved = dailySaved;
      balance += saved;
    }

    if (monthlyWithdrawal > 0 && day % withdrawalEvery === 0) {
      withdrawn = Math.min(balance, monthlyWithdrawal);
      balance -= withdrawn;
    }

    points.push({
      label: `D${day}`,
      day,
      saved: round(saved),
      withdrawn: round(withdrawn),
      balance: round(balance),
    });
  }

  return points;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function simulationSummary(points: ProfitBankSimulationPoint[]) {
  if (points.length === 0) {
    return { finalBalance: 0, totalSaved: 0, totalWithdrawn: 0 };
  }
  const last = points[points.length - 1];
  return {
    finalBalance: last.balance,
    totalSaved: round(points.reduce((s, p) => s + p.saved, 0)),
    totalWithdrawn: round(points.reduce((s, p) => s + p.withdrawn, 0)),
  };
}
