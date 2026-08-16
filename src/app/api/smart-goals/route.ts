import { NextRequest, NextResponse } from "next/server";
import { getSmartGoalsView } from "@/lib/smart-goals-service";
import { MSG, apiError } from "@/shared/api-messages";
import { isAllBusinesses } from "@/lib/business-units";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      const businessId = scope.businessId;
      const referenceDate = request.nextUrl.searchParams.get("date") ?? undefined;

      if (isAllBusinesses(businessId)) {
        return apiError("Selecione uma operação específica para ver metas inteligentes.", 400);
      }

      const view = await getSmartGoalsView(businessId, referenceDate);
      // getSmartGoalsView só retorna null em visão agregada (já tratada acima).
      if (!view) {
        return apiError("Selecione uma operação específica para ver metas inteligentes.", 400);
      }

      return NextResponse.json(view);
    });
  } catch (error) {
    console.error("Smart goals GET error:", error);
    return apiError(MSG.LOAD_GOALS);
  }
}
