import { eq, type SQL } from "drizzle-orm";
import type { Column } from "drizzle-orm";
import { isAllBusinesses, ALL_BUSINESSES_ID } from "@/lib/business-units";

export function businessScopeCondition(
  column: Column,
  businessId: string,
): SQL | undefined {
  if (isAllBusinesses(businessId)) return undefined;
  return eq(column, businessId);
}

export function filterByBusinessId<T extends { businessId: string }>(
  items: T[],
  businessId: string,
): T[] {
  if (isAllBusinesses(businessId)) return items;
  return items.filter((item) => item.businessId === businessId);
}

export { ALL_BUSINESSES_ID };
