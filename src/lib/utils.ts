import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatSaleShift, normalizeSaleShiftTime } from "@/lib/sale-shift";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateTime(date: string, time: string): string {
  // Exibe turno (Manhã/Tarde), não o HH:mm canônico gravado no banco.
  return `${formatDate(date)} · ${formatSaleShift(time)}`;
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function nowTime(): string {
  return normalizeSaleShiftTime(format(new Date(), "HH:mm"));
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function getWeekRange(date = new Date()) {
  return {
    start: format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    end: format(endOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

export function getMonthRange(date = new Date()) {
  return {
    start: format(startOfMonth(date), "yyyy-MM-dd"),
    end: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

export function getYearRange(date = new Date()) {
  return {
    start: format(startOfYear(date), "yyyy-MM-dd"),
    end: format(endOfYear(date), "yyyy-MM-dd"),
  };
}

export function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    pix: "PIX",
    card: "Cartão",
    cash: "Dinheiro",
  };
  return labels[method] ?? method;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function calcGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function goalProgress(current: number, target: number): number {
  if (target === 0) return 0;
  return Math.min((current / target) * 100, 100);
}

export const PRODUCT_CATEGORIES = [
  "Salgados",
  "Refrigerantes",
  "Água",
  "Café",
  "Brigadeiros",
  "Doces",
  "Combos",
  "Outros",
] as const;

export const DEPARTMENTS = [
  "Marketing",
  "Vendas",
  "Financeiro",
  "RH",
  "TI",
  "Operações",
  "Diretoria",
  "Outros",
] as const;

export const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "card", label: "Cartão" },
  { value: "cash", label: "Dinheiro" },
] as const;
