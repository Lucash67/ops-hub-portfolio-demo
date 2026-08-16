import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { DemoBanner } from "@/components/demo-banner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ops Hub — Portfolio Demo",
  description:
    "Demonstração pública de um centro operacional de gestão (vendas, financeiro, metas e indicadores). Dados fictícios.",
  icons: {
    icon: "/icons/hub-favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#050505",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <DemoBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
