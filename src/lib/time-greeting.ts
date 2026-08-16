const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export function resolveUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function getLocalHour(timeZone: string, date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value ?? 0);
}

/** Data local do usuário no formato yyyy-MM-dd. */
export function getLocalDateKey(timeZone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Saudação conforme horário local do usuário (fuso do navegador). */
export function getTimeGreeting(timeZone?: string, date = new Date()): string {
  const tz = timeZone ?? resolveUserTimeZone();
  const hour = getLocalHour(tz, date);

  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function getFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "Chefe";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}
