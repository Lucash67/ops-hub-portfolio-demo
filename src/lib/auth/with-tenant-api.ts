import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/auth/session";
import { runWithTenantContext } from "@/lib/auth/tenant-context";
import { resolveTenantScope, TenantAccessError, type TenantScope } from "@/lib/auth/tenant-scope";
import { apiError } from "@/shared/api-messages";

export async function withTenantScope<T>(
  user: SessionUser,
  businessIdParam: string | null | undefined,
  handler: (scope: TenantScope) => Promise<T>,
): Promise<T | NextResponse> {
  try {
    const scope = await resolveTenantScope(user.id, businessIdParam);
    return runWithTenantContext(
      {
        userId: user.id,
        dbIds: scope.dbIds,
        slugs: scope.slugs,
        slugToDbId: scope.slugToDbId,
        dbIdToSlug: scope.dbIdToSlug,
      },
      () => handler(scope),
    );
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return apiError(error.message, 403);
    }
    throw error;
  }
}
