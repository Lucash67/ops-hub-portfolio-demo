import { AsyncLocalStorage } from "async_hooks";

export interface TenantContext {
  userId: string;
  dbIds: string[];
  slugs: string[];
  slugToDbId: Record<string, string>;
  dbIdToSlug: Record<string, string>;
}

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return tenantStorage.run(ctx, fn);
}

export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

/** When set, queries must be limited to these business UUIDs / SQLite ids. */
export function getTenantDbIds(): string[] | undefined {
  return tenantStorage.getStore()?.dbIds;
}

export function getTenantUserId(): string | undefined {
  return tenantStorage.getStore()?.userId;
}
