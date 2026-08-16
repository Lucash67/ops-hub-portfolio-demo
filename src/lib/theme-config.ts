import { Moon, Sun, Sparkles } from "lucide-react";
import type { AppTheme } from "@/components/providers";

export const THEME_META: Record<
  AppTheme,
  { label: string; next: AppTheme; icon: typeof Sun }
> = {
  dark: { label: "Escuro", next: "light", icon: Moon },
  light: { label: "Claro", next: "brand", icon: Sun },
  brand: { label: "LH Teal", next: "dark", icon: Sparkles },
};

export function resolveTheme(value?: string): AppTheme {
  if (value === "light" || value === "brand") return value;
  return "dark";
}
