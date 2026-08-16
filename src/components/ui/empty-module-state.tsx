"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyModuleStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionHref?: string;
  actionLabel?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

/** Empty / zero-data state for hub modules — never looks like a crash. */
export function EmptyModuleState({
  title,
  description,
  icon: Icon = Inbox,
  actionHref,
  actionLabel,
  onRetry,
  className,
  compact = false,
}: EmptyModuleStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-lg flex-col items-center text-center",
        compact ? "rounded-xl border border-surface-border bg-surface-elevated/40 px-4 py-6" : "rounded-2xl border border-surface-border bg-surface-card px-5 py-8 sm:px-8 sm:py-10",
        className,
      )}
    >
      <div
        className={cn(
          "mb-3 flex items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange",
          compact ? "h-10 w-10" : "mb-4 h-12 w-12",
        )}
      >
        <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} />
      </div>
      <h3 className={cn("font-semibold text-text-primary", compact ? "text-sm" : "text-base sm:text-lg")}>
        {title}
      </h3>
      <p className={cn("mt-1.5 text-text-muted", compact ? "text-xs" : "text-sm")}>{description}</p>
      {(actionHref || onRetry) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {actionHref && actionLabel ? (
            <Link href={actionHref}>
              <Button size="sm">{actionLabel}</Button>
            </Link>
          ) : null}
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Tentar novamente
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
