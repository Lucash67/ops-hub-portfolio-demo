import { NextRequest, NextResponse } from "next/server";
import { getPerformanceView, type PerformancePeriod } from "@/lib/performance-service";
import { MSG, apiError } from "@/shared/api-messages";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      const params = request.nextUrl.searchParams;
      const businessId = scope.businessId;
      const period = (params.get("period") === "monthly" ? "monthly" : "weekly") as PerformancePeriod;
      const offset = Number(params.get("offset") ?? "0") || 0;
      const data = await getPerformanceView(businessId, period, offset);
      return NextResponse.json(data);
    });
  } catch (error) {
    console.error("Performance GET error:", error);
    return apiError(MSG.LOAD_PERFORMANCE);
  }
}
