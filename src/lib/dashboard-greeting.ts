/**
 * Frases de boas-vindas da dashboard.
 *
 * Layout em 3 linhas:
 *   1. Bom dia/Boa tarde/Boa noite, {Nome}.
 *   2. Headline conforme o tipo do dia em foco (útil / sábado / domingo).
 *   3. Deseja consultar algo mais, chefe?
 *
 * A saudação usa o horário local; a headline segue o dia em foco no filtro
 * temporal (não o relógio). Sem nome do dia nem data na copy.
 */
import { parseISO } from "date-fns";
import {
  getLocalDateKey,
  getTimeGreeting,
  resolveUserTimeZone,
} from "@/lib/time-greeting";

export const CHEFE_SUBTITLE = "Deseja consultar algo mais, chefe?";

export type GreetingMode =
  | "operate"
  | "saturday"
  | "sunday"
  | "review"
  | "future";

/** Qual painel lateral sustenta a headline. */
export type GreetingSideFocus = "day" | "week" | "conservative" | "none";

export interface DashboardGreeting {
  greeting: string;
  /** Segunda linha — o que o painel está mostrando. */
  headline: string;
  subtitle: string;
  mode: GreetingMode;
  sideFocus: GreetingSideFocus;
  /** Fim de semana ou dia fora de hoje: o painel é de consulta, não de ação. */
  isConsulting: boolean;
}

export interface GreetingInput {
  /** Dia em foco (yyyy-MM-dd). Ausente na visão geral (= hoje). */
  viewDate?: string | null;
  timeZone?: string;
  now?: Date;
}

function weekdayOf(dateKey: string): number {
  return parseISO(dateKey).getDay();
}

export function resolveDashboardGreeting({
  viewDate,
  timeZone,
  now = new Date(),
}: GreetingInput = {}): DashboardGreeting {
  const tz = timeZone ?? resolveUserTimeZone();
  const greeting = getTimeGreeting(tz, now);
  const today = getLocalDateKey(tz, now);
  const focus = viewDate ?? today;
  const weekday = weekdayOf(focus);

  const build = (
    mode: GreetingMode,
    headline: string,
    sideFocus: GreetingSideFocus,
  ): DashboardGreeting => ({
    greeting,
    headline,
    subtitle: CHEFE_SUBTITLE,
    mode,
    sideFocus,
    isConsulting: mode !== "operate",
  });

  if (weekday === 6) {
    return build("saturday", "Veja seu desempenho desta semana.", "week");
  }

  if (weekday === 0) {
    return build(
      "sunday",
      "Projeções conservadoras para essa semana:",
      "conservative",
    );
  }

  if (focus > today) {
    return build("future", "Esse dia ainda não chegou.", "none");
  }

  if (focus < today) {
    return build("review", "Aqui está seu desempenho de hoje.", "day");
  }

  return build("operate", "Aqui está seu desempenho de hoje.", "day");
}
