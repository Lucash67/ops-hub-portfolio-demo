import { format, startOfMonth } from "date-fns";
import { HUB_ENTERPRISES } from "@/constants/hub-brand";
import {
  ALL_BUSINESSES_ID,
  type BusinessUnit,
} from "@/lib/business-units";
import {
  buildOperationalDayMetrics,
  sortOperationalDays,
} from "@/lib/operational-day-metrics";
import type { OperationPulse, VisaoGeralPayload } from "@/lib/visao-geral";

function enterpriseDescription(businessId: string, fallbackName: string): string {
  const known = HUB_ENTERPRISES.find((e) => e.id === businessId);
  if (known) return known.description;
  return `Operação ${fallbackName}`;
}

async function buildPulse(
  businessId: string,
  name: string,
  slug: string,
  status: "active" | "inactive",
  monthStart: string,
): Promise<OperationPulse> {
  const metricsMap = await buildOperationalDayMetrics(businessId).catch(() => null);
  const days = metricsMap ? sortOperationalDays(metricsMap) : [];
  const monthDays = days.filter((day) => day.date >= monthStart);
  const last = days[days.length - 1] ?? null;

  return {
    businessId,
    name,
    slug,
    description: enterpriseDescription(businessId, name),
    status,
    lastDate: last?.date ?? null,
    revenueMonth: monthDays.reduce((sum, day) => sum + day.revenue, 0),
    profitMonth: monthDays.reduce((sum, day) => sum + day.profit, 0),
    unitsMonth: monthDays.reduce((sum, day) => sum + (day.units ?? 0), 0),
    operationalDaysMonth: monthDays.filter((day) => day.revenue > 0 || day.profit > 0).length,
    lastDayRevenue: last?.revenue ?? 0,
    lastDayProfit: last?.profit ?? 0,
  };
}

export async function buildVisaoGeralPayload(
  units: BusinessUnit[],
  now = new Date(),
): Promise<VisaoGeralPayload> {
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");

  const operations = await Promise.all(
    units.map((unit) =>
      buildPulse(unit.id, unit.name, unit.slug, unit.status, monthStart),
    ),
  );

  const consolidated = await buildPulse(
    ALL_BUSINESSES_ID,
    "Todas as operações",
    "all",
    "active",
    monthStart,
  );
  consolidated.description = "Visão consolidada da holding";

  return {
    generatedAt: now.toISOString(),
    operations,
    consolidated,
  };
}
