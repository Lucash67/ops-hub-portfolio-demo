import { NextRequest, NextResponse } from "next/server";
import { updateGoalTargets } from "@/lib/goals-service";
import { MSG, apiError } from "@/shared/api-messages";
import fs from "fs";
import { DB_PATH } from "@/lib/db";
import {
  isPostgresBackupSupported,
  listSettingsMap,
  upsertSetting,
} from "@/platform/db/repositories/settings-repository";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";
import { requireTenantBusinessWrite } from "@/lib/auth/tenant-scope";

export async function GET() {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, null, async () => {
      return NextResponse.json(await listSettingsMap());
    });
  } catch (error) {
    console.error("Settings GET error:", error);
    return apiError(MSG.LOAD_SETTINGS);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    const body = await request.json();
    return await withTenantScope(
      auth,
      body.businessId ?? request.nextUrl.searchParams.get("businessId"),
      async (scope) => {
        for (const [key, value] of Object.entries(body)) {
          if (key === "businessId") continue;
          await upsertSetting(key, String(value));
        }

        const hasGoalKeys =
          body.daily_goal !== undefined ||
          body.weekly_goal !== undefined ||
          body.monthly_goal !== undefined ||
          body.yearly_goal !== undefined ||
          body.daily_goal_units !== undefined ||
          body.weekly_goal_units !== undefined ||
          body.monthly_goal_units !== undefined;

        if (hasGoalKeys) {
          const businessId = requireTenantBusinessWrite(
            scope,
            body.businessId ?? request.nextUrl.searchParams.get("businessId"),
          );
          const parseUnits = (v: unknown) => {
            if (v === undefined) return undefined;
            if (v === null || v === "") return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
          };
          await updateGoalTargets(
            {
              ...(body.daily_goal !== undefined || body.daily_goal_units !== undefined
                ? {
                    daily: {
                      amount: Number(body.daily_goal ?? 0),
                      units: parseUnits(body.daily_goal_units),
                    },
                  }
                : {}),
              ...(body.weekly_goal !== undefined || body.weekly_goal_units !== undefined
                ? {
                    weekly: {
                      amount: Number(body.weekly_goal ?? 0),
                      units: parseUnits(body.weekly_goal_units),
                    },
                  }
                : {}),
              ...(body.monthly_goal !== undefined || body.monthly_goal_units !== undefined
                ? {
                    monthly: {
                      amount: Number(body.monthly_goal ?? 0),
                      units: parseUnits(body.monthly_goal_units),
                    },
                  }
                : {}),
              ...(body.yearly_goal !== undefined
                ? { yearly: { amount: Number(body.yearly_goal), units: null } }
                : {}),
            },
            businessId,
          );
        }

        return NextResponse.json({ success: true });
      },
    );
  } catch (error) {
    console.error("Settings PUT error:", error);
    if (error instanceof Error && error.message.includes("operação específica")) {
      return apiError(error.message, 400);
    }
    return apiError(MSG.SAVE_SETTINGS);
  }
}

export async function POST() {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    if (!isPostgresBackupSupported()) {
      return apiError(
        "Backup por arquivo disponível apenas com SQLite. Use backup do Supabase para PostgreSQL.",
        501,
      );
    }
    const backupData = fs.readFileSync(DB_PATH);
    const base64 = backupData.toString("base64");
    return NextResponse.json({ backup: base64, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Settings backup error:", error);
    return apiError(MSG.BACKUP);
  }
}
