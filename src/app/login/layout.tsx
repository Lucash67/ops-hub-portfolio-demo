import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./hub-login.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ops Hub — Entrar | Portfolio Demo",
  description:
    "Demonstração pública do Ops Hub. Use a conta demo para explorar vendas, estoque, financeiro e indicadores. Dados fictícios.",
  icons: {
    icon: "/icons/hub-favicon.svg",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`hub-login ${manrope.variable} h-full min-h-screen overflow-x-hidden antialiased lg:h-screen lg:overflow-hidden`}
      style={{ fontFamily: "var(--font-manrope), Inter, system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}
