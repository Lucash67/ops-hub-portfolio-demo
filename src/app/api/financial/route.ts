import { NextRequest, NextResponse } from "next/server";
import { getFinancialSummary } from "@/lib/analytics";
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
      const date = params.get("date");
      const viewMode = params.get("viewMode");

      const options =
        viewMode === "day" && date && /^\d{4}-\d{2}-\d{2}$/.test(date)
          ? { viewMode: "day" as const, date }
          : undefined;

      const data = await getFinancialSummary(businessId, options);
      return NextResponse.json(data);
    });
  } catch (error) {
    console.error("Financial GET error:", error);
    return apiError(MSG.LOAD_FINANCIAL);
  }
}
