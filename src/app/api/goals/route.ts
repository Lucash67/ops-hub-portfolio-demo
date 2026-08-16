import { NextRequest, NextResponse } from "next/server";
import { getGoalsWithProgress } from "@/lib/analytics";
import { MSG, apiError } from "@/shared/api-messages";
import { BUSINESS_GOALS_BLOCKED_MESSAGE } from "@/lib/business-units";
import {
  clearGoalsToSmart,
  initializeGoalsIfEmpty,
  updateGoalTargets,
  type GoalType,
  type GoalTargetInput,
} from "@/lib/goals-service";
import { findGoalByType, getGoalById, updateGoalById } from "@/platform/db/repositories/goal-repository";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";
import { requireTenantBusinessWrite } from "@/lib/auth/tenant-scope";

const GOAL_TYPES = new Set<GoalType>(["daily", "weekly", "monthly", "yearly"]);

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      const goalsData = await getGoalsWithProgress(scope.businessId);
      return NextResponse.json(goalsData);
    });
  } catch (error) {
    console.error("Goals GET error:", error);
    return apiError(MSG.LOAD_GOALS);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      const businessId = requireTenantBusinessWrite(scope, request.nextUrl.searchParams.get("businessId"));
      await initializeGoalsIfEmpty(businessId);
      const goalsData = await getGoalsWithProgress(businessId);
      return NextResponse.json(goalsData, { status: 201 });
    });
  } catch (error) {
    console.error("Goals POST error:", error);
    if (error instanceof Error && error.message.includes("operação específica")) {
      return apiError(error.message, 400);
    }
    return apiError(MSG.LOAD_GOALS);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      const businessId = requireTenantBusinessWrite(scope, request.nextUrl.searchParams.get("businessId"));
      const body = await request.json();

      // Voltar à sugestão automática (zera daily/weekly/monthly).
      if (body.useSmart === true) {
        const types = Array.isArray(body.types)
          ? (body.types as string[]).filter((t): t is GoalType => GOAL_TYPES.has(t as GoalType))
          : (["daily", "weekly", "monthly"] as GoalType[]);
        await clearGoalsToSmart(businessId, types);
        return NextResponse.json({ success: true, useSmart: true });
      }

      // Batch: { targets: { daily: { amount, units }, weekly: {...} } }
      if (body.targets && typeof body.targets === "object") {
        const targets: Partial<Record<GoalType, GoalTargetInput>> = {};
        for (const [type, raw] of Object.entries(body.targets as Record<string, unknown>)) {
          if (!GOAL_TYPES.has(type as GoalType)) continue;
          if (!raw || typeof raw !== "object") continue;
          const row = raw as {
            amount?: number | string;
            units?: number | string | null;
            targetAmount?: number | string;
            targetUnits?: number | string | null;
          };
          const amount = Number(row.amount ?? row.targetAmount ?? 0);
          const unitsRaw = row.units ?? row.targetUnits;
          const units =
            unitsRaw === null || unitsRaw === undefined || unitsRaw === ""
              ? null
              : Number(unitsRaw);
          targets[type as GoalType] = {
            amount: Number.isFinite(amount) ? amount : 0,
            units: units != null && Number.isFinite(units) ? units : null,
          };
        }
        await updateGoalTargets(targets, businessId);
        return NextResponse.json({ success: true });
      }

      // Single by type (cria se preciso)
      if (body.type && GOAL_TYPES.has(body.type)) {
        const type = body.type as GoalType;
        const amount = Number(body.targetAmount ?? body.amount ?? 0);
        const unitsRaw = body.targetUnits ?? body.units;
        const units =
          unitsRaw === null || unitsRaw === undefined || unitsRaw === ""
            ? null
            : Number(unitsRaw);
        await updateGoalTargets(
          {
            [type]: {
              amount: Number.isFinite(amount) ? amount : 0,
              units: units != null && Number.isFinite(units) ? units : null,
            },
          },
          businessId,
        );
        const saved = await findGoalByType(businessId, type);
        return NextResponse.json({ success: true, id: saved?.id ?? null });
      }

      // Legacy: by id
      if (!body.id) {
        return apiError("Informe id, type ou targets para atualizar a meta.", 400);
      }

      const goal = await getGoalById(body.id);
      if (!goal || goal.businessId !== businessId) {
        return apiError(BUSINESS_GOALS_BLOCKED_MESSAGE, 400);
      }

      const amount = Number(body.targetAmount ?? 0);
      const unitsRaw = body.targetUnits;
      const clearUnits = body.targetUnits === null || body.targetUnits === "";
      await updateGoalById(body.id, {
        targetAmount: Number.isFinite(amount) ? amount : 0,
        targetUnits: clearUnits
          ? null
          : unitsRaw !== undefined
            ? Number(unitsRaw)
            : goal.targetUnits,
        periodStart: goal.periodStart,
        periodEnd: goal.periodEnd,
      });

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error("Goals PUT error:", error);
    if (error instanceof Error && error.message.includes("operação específica")) {
      return apiError(error.message, 400);
    }
    return apiError(MSG.UPDATE_GOAL);
  }
}
