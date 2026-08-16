import { BRIGADEIROS_BUSINESS_ID, SALGADOS_BUSINESS_ID } from "@/lib/business-units";

/** Assets de marca (monograma / favicon). */
export const HUB_BRAND_ASSETS = {
  favicon: "/icons/hub-favicon.svg",
} as const;

/** Tokens visuais — paleta mint/teal. */
export const HUB_COLORS = {
  black: "#121212",
  yellow: "#00D4A8",
  secondary: "#14B8A6",
  mintLight: "#5EEAD4",
  white: "#FFFFFF",
  gray: {
    400: "#A0A0A0",
    500: "#8E8E93",
    600: "#525252",
    700: "#2A2A2A",
    800: "#1C1C1C",
    900: "#121212",
  },
} as const;

export type HubEnterpriseStatus = "active" | "coming_soon";

export interface HubEnterprise {
  id: string;
  index: string;
  name: string;
  description: string;
  status: HubEnterpriseStatus;
}

export const HUB_ENTERPRISES: HubEnterprise[] = [
  {
    id: SALGADOS_BUSINESS_ID,
    index: "01",
    name: "Salty",
    description: "Operação de salgados (demo)",
    status: "active",
  },
  {
    id: BRIGADEIROS_BUSINESS_ID,
    index: "02",
    name: "Candy",
    description: "Doces e confeitaria (demo)",
    status: "active",
  },
];

export const HUB_VALUE_PROPS = [
  {
    title: "Operação em tempo real",
    description: "Indicadores e vendas atualizados conforme a operação evolui.",
  },
  {
    title: "Dados protegidos",
    description: "Informações centralizadas com controle por empreendimento.",
  },
  {
    title: "Arquitetura escalável",
    description: "Pronto para novos negócios sem reestruturar a plataforma.",
  },
] as const;

/** Identidade fictícia para demonstração pública de portfólio. */
export const HUB_COPY = {
  holdingName: "NovaTech Solutions",
  holdingTagline: "Holding de negócios (demo)",
  productName: "Ops Hub",
  productTagline: "Centro operacional",
  heroTitle: "Vender no feeling cansa.",
  heroHighlight: "Controlar, escala.",
  heroTagline: "Ops Hub · NovaTech Solutions",
  heroDescription:
    "Ops Hub é um centro de gestão multi-operação. Integramos dados, equipes e indicadores em um único painel — esta versão pública usa apenas dados fictícios.",
  enterprisesHeading: "Operação ao vivo",
  footerSlogan: "Demonstração de produto para portfólio.",
  footerLegacy: "UI, analytics e operação em um só lugar — dados 100% fictícios.",
  authWelcome: "Bem-vindo ao",
  authSubtitle: "Explore a demonstração do centro operacional.",
} as const;
