/**
 * Catálogo e copy da Visão Geral — o hub que apresenta operações e funções.
 */
import {
  BookOpen,
  Calendar,
  CalendarClock,
  ClipboardPaste,
  FileText,
  LineChart,
  NotebookPen,
  Package,
  PiggyBank,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import { getLocalHour, getTimeGreeting, resolveUserTimeZone } from "@/lib/time-greeting";

export interface VisaoGeralGreeting {
  greeting: string;
  subtitle: string;
}

export function resolveVisaoGeralGreeting(
  _firstName: string,
  timeZone?: string,
  now = new Date(),
): VisaoGeralGreeting {
  const tz = timeZone ?? resolveUserTimeZone();
  const greeting = getTimeGreeting(tz, now);
  return {
    greeting,
    subtitle: "Escolha uma operação abaixo ou navegue pelo mapa completo do LH Hub.",
  };
}

export type SystemPillarId = "operate" | "money" | "performance" | "intelligence" | "catalog";

export interface SystemModuleLink {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Destaca o módulo como ação principal do pilar. */
  primary?: boolean;
}

export interface SystemPillar {
  id: SystemPillarId;
  title: string;
  subtitle: string;
  accent: string;
  accentDim: string;
  border: string;
  modules: SystemModuleLink[];
}

/** Mapa completo das funções principais — pausados ficam de fora. */
export const SYSTEM_PILLARS: SystemPillar[] = [
  {
    id: "operate",
    title: "Operar",
    subtitle: "O dia a dia da venda",
    accent: "text-brand-yellow",
    accentDim: "bg-brand-yellow/10",
    border: "border-brand-yellow/25",
    modules: [
      {
        href: "/",
        label: "Dashboard",
        hint: "Painel do dia e da semana",
        icon: LayoutDashboard,
        primary: true,
      },
      {
        href: "/registro-dia",
        label: "Registrar o dia",
        hint: "Colar rascunho e homologar",
        icon: ClipboardPaste,
      },
      {
        href: "/diario",
        label: "Diário",
        hint: "Histórico operacional",
        icon: BookOpen,
      },
      {
        href: "/notas",
        label: "Notas",
        hint: "Bloco de notas com autosave",
        icon: NotebookPen,
      },
      {
        href: "/calendario",
        label: "Calendário",
        hint: "Mapa visual dos dias",
        icon: Calendar,
      },
    ],
  },
  {
    id: "money",
    title: "Dinheiro",
    subtitle: "Caixa, lucro e reserva",
    accent: "text-brand-green",
    accentDim: "bg-brand-green/10",
    border: "border-brand-green/25",
    modules: [
      {
        href: "/financeiro",
        label: "Financeiro",
        hint: "Fluxo e posição",
        icon: Wallet,
        primary: true,
      },
      {
        href: "/banco-lucro",
        label: "Banco de Lucro",
        hint: "Lucro guardado",
        icon: PiggyBank,
      },
    ],
  },
  {
    id: "performance",
    title: "Performance",
    subtitle: "Ritmo, metas e tendência",
    accent: "text-brand-orange",
    accentDim: "bg-brand-orange/10",
    border: "border-brand-orange/25",
    modules: [
      {
        href: "/desempenho",
        label: "Desempenho",
        hint: "Semana e comparativos",
        icon: TrendingUp,
        primary: true,
      },
      {
        href: "/fechamento",
        label: "Fechamento",
        hint: "Mês e projeção",
        icon: CalendarClock,
      },
      {
        href: "/projecoes",
        label: "Projeções",
        hint: "Ritmo vs meta",
        icon: LineChart,
      },
      {
        href: "/metas",
        label: "Metas",
        hint: "Planejamento inteligente",
        icon: Target,
      },
    ],
  },
  {
    id: "intelligence",
    title: "Inteligência",
    subtitle: "Leitura e decisões",
    accent: "text-purple-400",
    accentDim: "bg-purple-500/10",
    border: "border-purple-500/25",
    modules: [
      {
        href: "/insights",
        label: "Insights",
        hint: "Recomendações automáticas",
        icon: Sparkles,
        primary: true,
      },
      {
        href: "/relatorios",
        label: "Relatórios",
        hint: "Consolidado exportável",
        icon: FileText,
      },
    ],
  },
  {
    id: "catalog",
    title: "Cadastros",
    subtitle: "Base da operação",
    accent: "text-blue-400",
    accentDim: "bg-blue-500/10",
    border: "border-blue-500/25",
    modules: [
      {
        href: "/produtos",
        label: "Produtos",
        hint: "Cardápio e custos",
        icon: Package,
      },
      {
        href: "/clientes",
        label: "Clientes",
        hint: "CRM e recorrência",
        icon: Users,
        primary: true,
      },
    ],
  },
];

export interface MomentSuggestion {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: LucideIcon;
}

/** Sugestão contextual pelo horário local — muda a “porta de entrada” do hub. */
export function resolveMomentSuggestion(
  timeZone?: string,
  now = new Date(),
): MomentSuggestion {
  const tz = timeZone ?? resolveUserTimeZone();
  const hour = getLocalHour(tz, now);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(now);
  const isWeekend = weekday === "Sat" || weekday === "Sun";

  if (isWeekend) {
    return {
      eyebrow: "Fim de semana",
      title: "Revise a semana que passou",
      description:
        "Salty não opera agora — use o tempo para olhar desempenho, fechamento e tendência do mês.",
      href: "/desempenho",
      cta: "Abrir desempenho",
      icon: TrendingUp,
    };
  }

  if (hour >= 5 && hour < 11) {
    return {
      eyebrow: "Manhã de operação",
      title: "Comece registrando o dia",
      description:
        "Cole o rascunho das encomendas e vendas — o resto do sistema se alimenta daí.",
      href: "/registro-dia",
      cta: "Registrar o dia",
      icon: ClipboardPaste,
    };
  }

  if (hour >= 11 && hour < 15) {
    return {
      eyebrow: "Meio do dia",
      title: "Acompanhe o painel ao vivo",
      description:
        "Veja lucro, meta e timeline do dia enquanto a operação ainda está rolando.",
      href: "/",
      cta: "Ir ao Dashboard",
      icon: LayoutDashboard,
    };
  }

  if (hour >= 15 && hour < 19) {
    return {
      eyebrow: "Tarde",
      title: "Feche números e caixa",
      description:
        "Confira financeiro, pendências e o que já entrou — antes de encerrar o expediente.",
      href: "/financeiro",
      cta: "Abrir financeiro",
      icon: Wallet,
    };
  }

  return {
    eyebrow: "Noite",
    title: "Planeje o próximo passo",
    description:
      "Metas, fechamento e insights — prepare o amanhã com a leitura do que já aconteceu.",
    href: "/fechamento",
    cta: "Ver tendência",
    icon: CalendarClock,
  };
}

export interface OperationPulse {
  businessId: string;
  name: string;
  slug: string;
  description: string;
  status: "active" | "inactive";
  /** Último dia operacional com dados. */
  lastDate: string | null;
  revenueMonth: number;
  profitMonth: number;
  unitsMonth: number;
  operationalDaysMonth: number;
  lastDayRevenue: number;
  lastDayProfit: number;
}

export interface VisaoGeralPayload {
  generatedAt: string;
  operations: OperationPulse[];
  consolidated: OperationPulse;
}
