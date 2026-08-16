"use client";

import { usePathname } from "next/navigation";
import { AppShell as BaseAppShell } from "@/components/layout/app-shell";
import { DateContextSelector } from "@/components/shared/date-context-selector";
import { TemporalDayChip } from "@/components/shared/temporal-day-chip";
import { TenantWorkspaceGate } from "@/components/onboarding/tenant-workspace-gate";
import { shouldShowTemporalFilter } from "@/lib/temporal-filter";

interface ModuleShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  temporalFilter?: boolean;
  /** Exibe chip compacto de contexto do dia (sem painel de insights). */
  temporalChip?: boolean;
}

/** AppShell dos módulos com seletor Geral/Dia no header (ADR-003). */
export function ModuleShell({
  children,
  title,
  subtitle,
  actions,
  temporalFilter = true,
  temporalChip = true,
}: ModuleShellProps) {
  const pathname = usePathname();
  const showTemporal = temporalFilter && shouldShowTemporalFilter(pathname);

  const headerActions = (
    <>
      {showTemporal && <DateContextSelector compact />}
      {actions}
    </>
  );

  return (
    <BaseAppShell title={title} subtitle={subtitle} actions={headerActions}>
      <TenantWorkspaceGate>
        {showTemporal && temporalChip && <TemporalDayChip />}
        {children}
      </TenantWorkspaceGate>
    </BaseAppShell>
  );
}
