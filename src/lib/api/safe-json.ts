/** Guarantees array data from APIs that may return `{ error }` objects. */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const r = await fetch(url, init);
  const json = await r.json().catch(() => ({}));
  if (!r.ok || (json && typeof json === "object" && "error" in json && json.error)) {
    throw new Error(
      typeof (json as { error?: string }).error === "string"
        ? (json as { error: string }).error
        : "Não foi possível carregar os dados.",
    );
  }
  return json;
}

export async function fetchJsonArray<T>(url: string, init?: RequestInit): Promise<T[]> {
  return asArray<T>(await fetchJson(url, init));
}
