import { z } from "zod";
import { normalizeSaleShiftTime } from "@/lib/sale-shift";
import {
  dayRegistrationPlanSchema,
  type DayRegistrationPlan,
  type DayRegistrationPreview,
} from "./types";

const DEPT_ACAL = "Escritório Central";

/** Remove campos de preview e normaliza plano antes do commit. */
export function sanitizeRegistrationPlan(input: DayRegistrationPreview | DayRegistrationPlan): DayRegistrationPlan {
  const {
    warnings: _w,
    errors: _e,
    productMatches: _pm,
    clientMatches: _cm,
    dayAlreadyRegistered: _dar,
    existingSalesCount: _esc,
    ...raw
  } = input as DayRegistrationPreview;

  const purchase = raw.purchase
    ? (() => {
        const products = raw.purchase.products.filter((p) => p.quantity > 0 && p.name.trim());
        const acalAllocation = raw.purchase.acalAllocation?.filter(
          (p) => p.quantity > 0 && p.name.trim(),
        );
        const fatherAllocation = raw.purchase.fatherAllocation?.filter(
          (p) => p.quantity > 0 && p.name.trim(),
        );

        return {
          ...raw.purchase,
          investment: Math.max(0, raw.purchase.investment),
          ownInvestment:
            raw.purchase.ownInvestment !== undefined
              ? Math.max(0, raw.purchase.ownInvestment)
              : undefined,
          thirdParty:
            raw.purchase.thirdParty && raw.purchase.thirdParty.amount > 0
              ? raw.purchase.thirdParty
              : undefined,
          products,
          acalAllocation: acalAllocation?.length ? acalAllocation : undefined,
          fatherAllocation: fatherAllocation?.length ? fatherAllocation : undefined,
        };
      })()
    : undefined;

  const summary = {
    ...raw.summary,
    revenue: Math.max(0, raw.summary.revenue),
    profit: raw.summary.profit,
    quantitySold: Math.max(0, raw.summary.quantitySold),
    quantityLost: Math.max(0, raw.summary.quantityLost ?? 0),
  };

  const sales = raw.sales.map((sale) => ({
    ...sale,
    time: normalizeSaleShiftTime(sale.time),
    department: sale.department?.trim() || DEPT_ACAL,
    clientName: sale.clientName.trim(),
    productName: sale.productName.trim(),
    quantity: Math.max(1, sale.quantity),
  }));

  const newClients = raw.newClients
    .filter((c) => c.name.trim())
    .map((c) => ({
      name: c.name.trim(),
      sector: c.sector?.trim() || DEPT_ACAL,
      notes: c.notes?.trim() || undefined,
    }));

  return dayRegistrationPlanSchema.parse({
    ...raw,
    purchase,
    summary,
    sales,
    newClients,
  });
}

export function formatPlanValidationError(error: z.ZodError): string {
  const parts = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "plano";
    return `${path}: ${issue.message}`;
  });
  return parts.length > 0 ? parts.join(" · ") : "Plano de registro inválido.";
}
