"use client";

import { Cloud, CloudOff, Loader2, Check } from "lucide-react";
import type { SaveStatus } from "@/hooks/use-sticky-notes";
import { cn } from "@/lib/utils";

const COPY: Record<SaveStatus, { label: string; className: string; Icon: typeof Check }> = {
  idle: { label: "Pronto", className: "text-text-muted", Icon: Cloud },
  saving: { label: "Salvando...", className: "text-brand-yellow", Icon: Loader2 },
  saved: { label: "Tudo salvo", className: "text-emerald-400", Icon: Check },
  offline: {
    label: "Offline — guardado neste aparelho",
    className: "text-orange-300",
    Icon: CloudOff,
  },
  error: { label: "Erro ao sincronizar", className: "text-red-300", Icon: CloudOff },
};

export function StickySaveStatus({ status }: { status: SaveStatus }) {
  const { label, className, Icon } = COPY[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", className)}>
      <Icon className={cn("h-3.5 w-3.5", status === "saving" && "animate-spin")} />
      {label}
    </span>
  );
}
