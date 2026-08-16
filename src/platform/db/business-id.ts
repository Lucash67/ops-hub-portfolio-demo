import { getTenantContext } from "@/lib/auth/tenant-context";
import { isPostgres } from "./config";
import {
  BRIGADEIROS_BUSINESS_ID,
  SALGADOS_BUSINESS_ID,
  type BusinessUnit,
} from "@/lib/business-units";

/** UUIDs fixos para seed Postgres — mapeiam aos slugs legados do SQLite. */
export const POSTGRES_BUSINESS_UUIDS = {
  [SALGADOS_BUSINESS_ID]: "00000000-0000-4000-8000-000000000001",
  [BRIGADEIROS_BUSINESS_ID]: "00000000-0000-4000-8000-000000000002",
} as const;

const SLUG_BY_UUID = Object.fromEntries(
  Object.entries(POSTGRES_BUSINESS_UUIDS).map(([slug, uuid]) => [uuid, slug]),
) as Record<string, string>;

export function toDbBusinessId(slug: string): string {
  if (!isPostgres()) return slug;
  const fromTenant = getTenantContext()?.slugToDbId[slug];
  if (fromTenant) return fromTenant;
  return POSTGRES_BUSINESS_UUIDS[slug as keyof typeof POSTGRES_BUSINESS_UUIDS] ?? slug;
}

export function fromDbBusinessId(dbId: string): string {
  if (!isPostgres()) return dbId;
  const fromTenant = getTenantContext()?.dbIdToSlug[dbId];
  if (fromTenant) return fromTenant;
  return SLUG_BY_UUID[dbId] ?? dbId;
}

export function postgresBusinessSeedRows(): Array<{
  id: string;
  slug: string;
  name: string;
  status: "active";
}> {
  return [
    {
      id: POSTGRES_BUSINESS_UUIDS[SALGADOS_BUSINESS_ID],
      slug: SALGADOS_BUSINESS_ID,
      name: "Salty",
      status: "active",
    },
    {
      id: POSTGRES_BUSINESS_UUIDS[BRIGADEIROS_BUSINESS_ID],
      slug: BRIGADEIROS_BUSINESS_ID,
      name: "Candy",
      status: "active",
    },
  ];
}

export function mapBusinessRowToLegacy(row: {
  id: string;
  slug: string;
  name: string;
  status: string;
}): BusinessUnit {
  const slug = isPostgres() ? row.slug : row.id;
  // Nome canônico do catálogo (Salty/Candy) prevalece sobre o texto antigo no banco.
  const catalogName =
    slug === SALGADOS_BUSINESS_ID
      ? "Salty"
      : slug === BRIGADEIROS_BUSINESS_ID
        ? "Candy"
        : row.name;
  return {
    id: slug,
    name: catalogName,
    slug: row.slug,
    status: row.status as "active" | "inactive",
  };
}
