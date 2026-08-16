import { addDays, format, getDay, parseISO } from "date-fns";
import { SALGADOS_BUSINESS_ID } from "@/lib/business-units";

/** Salgados opera seg–sex; demais negócios contam todos os dias. */
export function isOperationalDay(date: string, businessId: string): boolean {
  if (businessId !== SALGADOS_BUSINESS_ID && businessId !== "salgados") return true;
  const day = getDay(parseISO(date));
  return day !== 0 && day !== 6;
}

/** Conta dias operacionais inclusivos entre start e end (yyyy-MM-dd). */
export function countOperationalDaysInRange(
  start: string,
  end: string,
  businessId: string,
): number {
  if (start > end) return 0;
  let count = 0;
  let cursor = parseISO(start);
  const endDate = parseISO(end);
  while (cursor <= endDate) {
    const key = format(cursor, "yyyy-MM-dd");
    if (isOperationalDay(key, businessId)) count++;
    cursor = addDays(cursor, 1);
  }
  return count;
}

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export const WEEKDAY_MON_FRI = [
  { index: 1, label: "Seg" },
  { index: 2, label: "Ter" },
  { index: 3, label: "Qua" },
  { index: 4, label: "Qui" },
  { index: 5, label: "Sex" },
] as const;
