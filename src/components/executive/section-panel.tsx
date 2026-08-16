"use client";

import { cn } from "@/components/ui/utils";
import type { ModuleTheme } from "@/lib/module-themes";
import { MODULE_THEMES } from "@/lib/module-themes";

interface SectionPanelProps {
  theme?: ModuleTheme;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionPanel({
  theme = "dashboard",
  title,
  subtitle,
  children,
  className,
}: SectionPanelProps) {
  const t = MODULE_THEMES[theme];

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 className={cn("text-sm font-semibold", t.accent)}>{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
