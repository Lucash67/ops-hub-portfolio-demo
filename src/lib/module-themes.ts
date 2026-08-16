/** Cores de contexto por módulo — identidade visual executiva. */
export type ModuleTheme = "dashboard" | "finance" | "goals" | "alerts" | "operations" | "clients" | "reports" | "performance";

export const MODULE_THEMES: Record<
  ModuleTheme,
  { accent: string; accentDim: string; border: string; label: string }
> = {
  dashboard: {
    accent: "text-blue-400",
    accentDim: "bg-blue-500/10",
    border: "border-blue-500/20",
    label: "Dashboard",
  },
  finance: {
    accent: "text-brand-green",
    accentDim: "bg-brand-green/10",
    border: "border-brand-green/20",
    label: "Financeiro",
  },
  goals: {
    accent: "text-purple-400",
    accentDim: "bg-purple-500/10",
    border: "border-purple-500/20",
    label: "Metas",
  },
  alerts: {
    accent: "text-brand-orange",
    accentDim: "bg-brand-orange/10",
    border: "border-brand-orange/20",
    label: "Alertas",
  },
  operations: {
    accent: "text-brand-red",
    accentDim: "bg-brand-red/10",
    border: "border-brand-red/20",
    label: "Operações",
  },
  clients: {
    accent: "text-blue-400",
    accentDim: "bg-blue-500/10",
    border: "border-blue-500/20",
    label: "Clientes",
  },
  reports: {
    accent: "text-blue-400",
    accentDim: "bg-blue-500/10",
    border: "border-blue-500/20",
    label: "Relatórios",
  },
  performance: {
    accent: "text-brand-orange",
    accentDim: "bg-brand-orange/10",
    border: "border-brand-orange/20",
    label: "Desempenho",
  },
};
