import {
  LayoutDashboard,
  LayoutGrid,
  ShoppingCart,
  Package,
  Warehouse,
  Users,
  Wallet,
  Target,
  Sparkles,
  FileText,
  Calendar,
  CalendarClock,
  BookOpen,
  NotebookPen,
  Settings,
  TrendingUp,
  LineChart,
  PiggyBank,
  ClipboardPaste,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Módulo pausado — oculto do menu, rota permanece ativa para reativação futura. */
  paused?: boolean;
}

/** Setor/departamento do menu — agrupa módulos na sidebar. */
export type NavSectorId =
  | "operate"
  | "money"
  | "performance"
  | "intelligence"
  | "catalog";

export interface NavSector {
  id: NavSectorId;
  label: string;
  items: NavItem[];
}

const NAV_BY_HREF = {
  visaoGeral: { href: "/visao-geral", label: "Visão Geral", icon: LayoutGrid },
  dashboard: { href: "/", label: "Dashboard", icon: LayoutDashboard },
  vendas: { href: "/vendas", label: "Vendas", icon: ShoppingCart, paused: true },
  produtos: { href: "/produtos", label: "Produtos", icon: Package },
  estoque: { href: "/estoque", label: "Estoque", icon: Warehouse, paused: true },
  clientes: { href: "/clientes", label: "Clientes", icon: Users },
  financeiro: { href: "/financeiro", label: "Financeiro", icon: Wallet },
  desempenho: { href: "/desempenho", label: "Desempenho", icon: TrendingUp },
  projecoes: { href: "/projecoes", label: "Projeções", icon: LineChart },
  fechamento: {
    href: "/fechamento",
    label: "Fechamento & Tendência",
    icon: CalendarClock,
  },
  bancoLucro: { href: "/banco-lucro", label: "Banco de Lucro", icon: PiggyBank },
  metas: { href: "/metas", label: "Metas", icon: Target },
  insights: { href: "/insights", label: "Insights", icon: Sparkles },
  relatorios: { href: "/relatorios", label: "Relatórios", icon: FileText },
  diario: { href: "/diario", label: "Diário Operacional", icon: BookOpen },
  notas: { href: "/notas", label: "Notas", icon: NotebookPen },
  registroDia: { href: "/registro-dia", label: "Registro do Dia", icon: ClipboardPaste },
  calendario: { href: "/calendario", label: "Calendário", icon: Calendar },
  configuracoes: { href: "/configuracoes", label: "Configurações", icon: Settings },
} as const satisfies Record<string, NavItem>;

/** Hub sempre no topo, fora dos setores. */
export const NAV_PINNED_TOP: NavItem[] = [NAV_BY_HREF.visaoGeral];

/** Sistema / ajustes — sempre no fim da lista de módulos. */
export const NAV_PINNED_BOTTOM: NavItem[] = [NAV_BY_HREF.configuracoes];

/**
 * Módulos agrupados por setor (mesma lógica do mapa da Visão Geral).
 * Pausados entram aqui, mas a sidebar filtra `paused`.
 */
export const NAV_SECTORS: NavSector[] = [
  {
    id: "operate",
    label: "Operação",
    items: [
      NAV_BY_HREF.dashboard,
      NAV_BY_HREF.registroDia,
      NAV_BY_HREF.diario,
      NAV_BY_HREF.notas,
      NAV_BY_HREF.calendario,
      NAV_BY_HREF.vendas,
    ],
  },
  {
    id: "money",
    label: "Dinheiro",
    items: [NAV_BY_HREF.financeiro, NAV_BY_HREF.bancoLucro],
  },
  {
    id: "performance",
    label: "Performance",
    items: [
      NAV_BY_HREF.desempenho,
      NAV_BY_HREF.fechamento,
      NAV_BY_HREF.projecoes,
      NAV_BY_HREF.metas,
    ],
  },
  {
    id: "intelligence",
    label: "Inteligência",
    items: [NAV_BY_HREF.insights, NAV_BY_HREF.relatorios],
  },
  {
    id: "catalog",
    label: "Cadastros",
    items: [NAV_BY_HREF.produtos, NAV_BY_HREF.clientes, NAV_BY_HREF.estoque],
  },
];

/** Lista plana (compat / buscas). Ordem: pin topo → setores → pin fundo. */
export const NAV_ITEMS: NavItem[] = [
  ...NAV_PINNED_TOP,
  ...NAV_SECTORS.flatMap((s) => s.items),
  ...NAV_PINNED_BOTTOM,
];

export const SIDEBAR_WIDTH = 240;

/** Destinos da barra inferior no celular — o resto fica no menu lateral. */
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { href: "/visao-geral", label: "Hub", icon: LayoutGrid },
  { href: "/registro-dia", label: "Registrar", icon: ClipboardPaste },
  { href: "/desempenho", label: "Semana", icon: TrendingUp },
  { href: "/fechamento", label: "Tendência", icon: CalendarClock },
];

export const APP_NAME = "Ops Hub";
export const APP_TAGLINE = "Centro operacional";
