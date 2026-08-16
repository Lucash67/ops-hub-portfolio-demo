/** Identificador virtual para visão consolidada (não persiste em banco). */
export const ALL_BUSINESSES_ID = "all";

export const SALGADOS_BUSINESS_ID = "salgados";
export const BRIGADEIROS_BUSINESS_ID = "brigadeiros";

/** Operação padrão para registros sem contexto explícito (legado + novos cadastros). */
export const DEFAULT_BUSINESS_ID = SALGADOS_BUSINESS_ID;

export interface BusinessUnit {
  id: string;
  name: string;
  slug: string;
  status: "active" | "inactive";
}

export const BUSINESS_UNITS: BusinessUnit[] = [
  { id: SALGADOS_BUSINESS_ID, name: "Salty", slug: "salgados", status: "active" },
  { id: BRIGADEIROS_BUSINESS_ID, name: "Candy", slug: "brigadeiros", status: "active" },
];

export function getBusinessUnitName(businessId: string): string {
  if (businessId === ALL_BUSINESSES_ID) return "Todos";
  return BUSINESS_UNITS.find((b) => b.id === businessId)?.name ?? businessId;
}

export function isAllBusinesses(businessId: string): boolean {
  return businessId === ALL_BUSINESSES_ID;
}

export function parseBusinessIdParam(param: string | null | undefined): string {
  if (!param || param === ALL_BUSINESSES_ID) return ALL_BUSINESSES_ID;
  const trimmed = param.trim();
  if (!trimmed || trimmed === ALL_BUSINESSES_ID) return ALL_BUSINESSES_ID;
  return trimmed;
}

export function withBusinessQuery(baseUrl: string, businessId: string): string {
  if (isAllBusinesses(businessId)) return baseUrl;
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}businessId=${encodeURIComponent(businessId)}`;
}

export function canWriteForBusiness(businessId: string): boolean {
  return !isAllBusinesses(businessId);
}

export const BUSINESS_WRITE_BLOCKED_MESSAGE =
  "Selecione uma operação específica para realizar esta ação.";

export const BUSINESS_GOALS_BLOCKED_MESSAGE =
  "Selecione uma operação específica para editar suas metas.";

/** Rejeita visão consolidada em operações de escrita. */
export function requireSpecificBusinessId(
  businessId: string | null | undefined,
): string {
  const parsed = businessId?.trim();
  if (!parsed || isAllBusinesses(parsed)) {
    throw new Error(BUSINESS_WRITE_BLOCKED_MESSAGE);
  }
  return parsed;
}
