/** Produto placeholder quando o sabor não foi identificado na venda. */
export const UNIDENTIFIED_FLAVOR_PRODUCT_NAME = "Salgado (sabor não identificado)";

function normalizeFlavorLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Vendas com sabor desconhecido entram no total do dia, mas não nos gráficos de sabores. */
export function isUnidentifiedFlavorProduct(name: string): boolean {
  const n = normalizeFlavorLabel(name);
  if (!n) return true;
  if (n === "desconhecido") return true;
  if (n.includes("sabor nao identificado")) return true;
  if (n.includes("nao identificado") && n.includes("salgado")) return true;
  return normalizeFlavorLabel(UNIDENTIFIED_FLAVOR_PRODUCT_NAME) === n;
}

export function excludeUnidentifiedFlavors(
  breakdown: Record<string, number>,
): Record<string, number> {
  const filtered: Record<string, number> = {};
  for (const [name, quantity] of Object.entries(breakdown)) {
    if (isUnidentifiedFlavorProduct(name)) continue;
    filtered[name] = quantity;
  }
  return filtered;
}

export function countUnidentifiedFlavorUnits(breakdown: Record<string, number>): number {
  return Object.entries(breakdown).reduce(
    (sum, [name, quantity]) => (isUnidentifiedFlavorProduct(name) ? sum + quantity : sum),
    0,
  );
}

/** Agrupa nomes de produto em sabores canônicos para mix do dia. */
export function canonicalSalgadosFlavor(name: string): string | null {
  if (!name.trim() || isUnidentifiedFlavorProduct(name)) return null;
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (n.includes("croissant")) return "Croissant";
  if (n.includes("cheddar") && n.includes("forno")) return "Carne c/ Cheddar Forno";
  if (n.includes("cheddar") || (n.includes("carne") && n.includes("frito") && !n.includes("pastel"))) {
    return "Carne Frito";
  }
  if (n.includes("pastel") && n.includes("carne")) return "Pastel de Carne";
  if (n.includes("mistao frito") || (n.includes("pastel") && !n.includes("carne"))) return "Mistão Frito";
  if (n.includes("mistao") || n.includes("misto") || n.includes("frango")) return "Mistão de Forno";
  return name.trim();
}

/** Venda excluída do mix (roubo, não pagou, etc.). */
export function isSaleExcludedFromMix(sale: {
  paymentStatus?: string | null;
  notes?: string | null;
}): boolean {
  const notes = (sale.notes ?? "").toLowerCase();
  if (
    sale.paymentStatus === "pending" &&
    (notes.includes("nao pagou") ||
      notes.includes("não pagou") ||
      notes.includes("roub") ||
      notes.includes("pegou quando"))
  ) {
    return true;
  }
  return false;
}
