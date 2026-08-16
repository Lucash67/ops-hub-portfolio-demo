import { NextRequest, NextResponse } from "next/server";
import { getProjections } from "@/lib/analytics";
import {
  getPeriodProjectionView,
  getProjectionCycleBanner,
  type PeriodProjectionPeriod,
} from "@/lib/period-projections-service";
import { MSG, apiError } from "@/shared/api-messages";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";

const PERIODS = new Set<PeriodProjectionPeriod>([
  "weekly",
  "monthly",
  "bimonthly",
  "quarterly",
]);

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      const params = request.nextUrl.searchParams;
      const mode = params.get("mode");
      const periodParam = params.get("period");

      if (mode === "simulator") {
        return NextResponse.json(await getProjections(scope.businessId));
      }

      if (mode === "cycle-banner") {
        const banner = await getProjectionCycleBanner(scope.businessId);
        return NextResponse.json(banner);
      }

      if (
        (periodParam && PERIODS.has(periodParam as PeriodProjectionPeriod)) ||
        mode === "period"
      ) {
        const period = PERIODS.has(periodParam as PeriodProjectionPeriod)
          ? (periodParam as PeriodProjectionPeriod)
          : "weekly";
        const offset = Number(params.get("offset") ?? "0");
        const safeOffset = Number.isFinite(offset) ? Math.min(0, Math.trunc(offset)) : 0;
        const view = await getPeriodProjectionView(scope.businessId, period, safeOffset);
        return NextResponse.json(view);
      }

      // Retrocompatível: sem period → simulador estático antigo.
      return NextResponse.json(await getProjections(scope.businessId));
    });
  } catch (error) {
    console.error("Projections GET error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return apiError(
      process.env.NODE_ENV === "development"
        ? `${MSG.LOAD_PROJECTIONS} (${detail})`
        : MSG.LOAD_PROJECTIONS,
    );
  }
}
