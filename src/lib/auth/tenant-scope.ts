import { ALL_BUSINESSES_ID, isAllBusinesses, BUSINESS_WRITE_BLOCKED_MESSAGE } from "@/lib/business-units";
import { listBusinesses } from "@/platform/db/repositories/business-repository";

export class TenantAccessError extends Error {
  constructor(message = "Esta operação não pertence à sua conta.") {
    super(message);
    this.name = "TenantAccessError";
  }
}

export interface TenantScope {
  businessId: string;
  slugs: string[];
  dbIds: string[];
  slugToDbId: Record<string, string>;
  dbIdToSlug: Record<string, string>;
  isEmpty: boolean;
}

export async function resolveTenantScope(
  userId: string,
  businessIdParam: string | null | undefined,
): Promise<TenantScope> {
  const units = await listBusinesses(userId);
  const slugs = units.map((u) => u.id);
  const dbIds = units.map((u) => u.dbId);
  const slugToDbId = Object.fromEntries(units.map((u) => [u.id, u.dbId]));
  const dbIdToSlug = Object.fromEntries(units.map((u) => [u.dbId, u.id]));

  const raw = businessIdParam?.trim();
  let businessId =
    !raw || raw === ALL_BUSINESSES_ID ? ALL_BUSINESSES_ID : raw;

  // Stale client selector (e.g. previous account) must not 403 the whole app.
  if (!isAllBusinesses(businessId) && !slugs.includes(businessId)) {
    businessId = ALL_BUSINESSES_ID;
  }

  return {
    businessId,
    slugs,
    dbIds,
    slugToDbId,
    dbIdToSlug,
    isEmpty: slugs.length === 0,
  };
}

export function requireTenantBusinessWrite(
  scope: TenantScope,
  businessId: string | null | undefined,
): string {
  const parsed = businessId?.trim();
  if (!parsed || isAllBusinesses(parsed)) {
    throw new Error(BUSINESS_WRITE_BLOCKED_MESSAGE);
  }
  if (!scope.slugs.includes(parsed)) {
    throw new TenantAccessError();
  }
  return parsed;
}
