import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/shared/api-messages";
import {
  commitDayRegistration,
  previewDayRegistration,
} from "@/lib/day-registration/day-registration-service";
import {
  formatPlanValidationError,
  sanitizeRegistrationPlan,
} from "@/lib/day-registration/plan-sanitize";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";
import { requireTenantBusinessWrite } from "@/lib/auth/tenant-scope";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    const body = await request.json();
    const mode = body.mode as string;

    if (mode === "parse") {
      return await withTenantScope(auth, null, async () => {
        if (!body.draft || typeof body.draft !== "string") {
          return apiError("Informe o rascunho do dia.", 400);
        }

        const preview = await previewDayRegistration(body.draft);
        return NextResponse.json(preview);
      });
    }

    if (mode === "commit") {
      return await withTenantScope(auth, body.plan?.businessId, async (scope) => {
        requireTenantBusinessWrite(scope, body.plan?.businessId);

        let plan;
        try {
          plan = sanitizeRegistrationPlan(body.plan);
        } catch (error) {
          if (error instanceof z.ZodError) {
            console.error("Day registration plan validation:", error.flatten());
            return apiError(formatPlanValidationError(error), 400);
          }
          throw error;
        }

        const result = await commitDayRegistration(plan);
        return NextResponse.json({
          success: true,
          ...result,
          message: `Dia ${plan.date} registrado com ${result.saleIds.length} venda(s).`,
        });
      });
    }

    return apiError("Modo inválido. Use parse ou commit.", 400);
  } catch (error) {
    console.error("Day registration error:", error);
    if (error instanceof Error && error.message.includes("operação específica")) {
      return apiError(error.message, 400);
    }
    const message = error instanceof Error ? error.message : "Não foi possível processar o registro do dia.";
    return apiError(message, 400);
  }
}
