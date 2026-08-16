import { NextRequest, NextResponse } from "next/server";
import { isAllBusinesses, BUSINESS_GOALS_BLOCKED_MESSAGE } from "@/lib/business-units";
import { applyForecastGoals, getMonthCloseView } from "@/lib/month-close-service";
import type { ForecastScenarioKey } from "@/lib/month-close-view";
import { MSG, apiError } from "@/shared/api-messages";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { requireTenantBusinessWrite } from "@/lib/auth/tenant-scope";
import { withTenantScope } from "@/lib/auth/with-tenant-api";

const SCENARIOS: ForecastScenarioKey[] = ["conservador", "realista", "ambicioso"];

function parseMonthKey(value: string | null): string | undefined {
  if (!value) return undefined;
  return /^\d{4}-\d{2}$/.test(value) ? value : undefined;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(
      auth,
      request.nextUrl.searchParams.get("businessId"),
      async (scope) => {
        const monthKey = parseMonthKey(request.nextUrl.searchParams.get("month"));
        const view = await getMonthCloseView(scope.businessId, monthKey);
        // Conta nova / sem histórico: payload vazio (200), não 404 — o módulo deve abrir zerado.
        if (!view) {
          return NextResponse.json({
            empty: true as const,
            message:
              "Ainda não há um mês com dias registrados para fechar. Registre alguns dias e volte aqui.",
          });
        }
        return NextResponse.json(view);
      },
    );
  } catch (error) {
    console.error("Month close GET error:", error);
    return apiError(MSG.LOAD_MONTH_CLOSE);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(
      auth,
      request.nextUrl.searchParams.get("businessId"),
      async (scope) => {
        const businessId = requireTenantBusinessWrite(
          scope,
          request.nextUrl.searchParams.get("businessId"),
        );
        if (isAllBusinesses(businessId)) {
          return apiError(BUSINESS_GOALS_BLOCKED_MESSAGE, 400);
        }

        const body = await request.json().catch(() => ({}));
        const scenario: ForecastScenarioKey = SCENARIOS.includes(body.scenario)
          ? body.scenario
          : "realista";
        const result = await applyForecastGoals(
          businessId,
          scenario,
          parseMonthKey(body.month ?? null),
        );
        return NextResponse.json(result);
      },
    );
  } catch (error) {
    console.error("Month close POST error:", error);
    const detail = error instanceof Error ? error.message : "";
    if (detail.includes("operação específica") || detail.includes("mês fechado")) {
      return apiError(detail, 400);
    }
    return apiError(MSG.APPLY_FORECAST_GOALS);
  }
}
