/**
 * Turnos de venda — manhã / tarde.
 *
 * No banco continuamos gravando HH:mm (compatível com o schema), mas a UI e o
 * rascunho do dia só falam em turnos. Horários legados são mapeados pelo corte
 * das 13h.
 */

export type SaleShift = "morning" | "afternoon";

/** Representação canônica no banco (HH:mm). */
export const SHIFT_TIME: Record<SaleShift, string> = {
  morning: "10:00",
  afternoon: "15:00",
};

export const SHIFT_LABEL: Record<SaleShift, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
};

/** Antes das 13h = manhã; a partir das 13h = tarde. */
export const SHIFT_CUTOFF_HOUR = 13;

export function shiftFromHour(hour: number): SaleShift {
  return hour < SHIFT_CUTOFF_HOUR ? "morning" : "afternoon";
}

export function shiftFromTime(time: string): SaleShift {
  const hour = parseInt(time.trim().split(":")[0] ?? "12", 10);
  if (Number.isNaN(hour)) return "morning";
  return shiftFromHour(hour);
}

/** Aceita "manhã", "tarde", "manha", "10:00", etc. */
export function parseSaleShift(raw: string | null | undefined): SaleShift | null {
  if (!raw) return null;
  const n = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/\bmanha\b/.test(n) || n === "m") return "morning";
  if (/\btarde\b/.test(n) || n === "t") return "afternoon";

  const hhmm = n.match(/\b(\d{1,2}):(\d{2})\b/);
  if (hhmm) {
    return shiftFromHour(parseInt(hhmm[1]!, 10));
  }

  return null;
}

/** Normaliza qualquer entrada de turno/hora para o HH:mm canônico do turno. */
export function normalizeSaleShiftTime(raw: string | null | undefined): string {
  const shift = parseSaleShift(raw) ?? "morning";
  return SHIFT_TIME[shift];
}

export function formatSaleShift(time: string): string {
  return SHIFT_LABEL[shiftFromTime(time)];
}

export function formatSaleShiftDateTime(dateLabel: string, time: string): string {
  return `${dateLabel} · ${formatSaleShift(time)}`;
}
