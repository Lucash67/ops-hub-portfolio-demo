import { NextRequest, NextResponse } from "next/server";
import { generateInsights } from "@/lib/insights-engine";
import { generateDiaryAutoInsights, generateRecentDiaryInsights } from "@/lib/diary-auto-insights";
import { MSG, apiError } from "@/shared/api-messages";
import { isAllBusinesses } from "@/lib/business-units";
import type { Insight } from "@/lib/insights-engine";
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

      const executive = await generateInsights(businessId, {
        date: date ?? undefined,
        viewMode: viewMode ?? undefined,
      });

      let diaryInsights: Insight[] = [];
      if (!isAllBusinesses(businessId)) {
        const raw =
          viewMode === "day" && date
            ? await generateDiaryAutoInsights(businessId, date)
            : await generateRecentDiaryInsights(businessId, 5);

        diaryInsights = raw.map((d) => ({
          id: `diary-${d.id}`,
          type: d.type,
          title: d.title,
          description: d.description,
          metric: d.metric,
        }));
      }

      const merged = [...diaryInsights, ...executive];
      const seen = new Set<string>();
      const deduped = merged.filter((i) => {
        if (seen.has(i.id)) return false;
        seen.add(i.id);
        return true;
      });

      return NextResponse.json(deduped);
    });
  } catch (error) {
    console.error("Insights GET error:", error);
    return apiError(MSG.LOAD_INSIGHTS);
  }
}
