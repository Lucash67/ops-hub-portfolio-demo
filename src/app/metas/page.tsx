"use client";

import { useQuery } from "@tanstack/react-query";
import { ModuleShell } from "@/components/layout/module-shell";
import { BusinessWriteNotice } from "@/components/business/business-write-notice";
import { PageLoader } from "@/components/ui/loading";
import { EmptyModuleState } from "@/components/ui/empty-module-state";
import { SmartGoalsDashboard } from "@/components/goals/smart-goals-dashboard";
import { Target } from "lucide-react";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { isAllBusinesses } from "@/lib/business-units";
import type { SmartGoalsView } from "@/lib/smart-goals-view";

export default function MetasPage() {
  const { activeBusinessId, withQuery, goalsBlockedMessage } = useBusinessScope();
  const isAggregated = isAllBusinesses(activeBusinessId);

  const { data: view, isLoading, isError, error, refetch } = useQuery<SmartGoalsView>({
    queryKey: ["smart-goals", activeBusinessId],
    queryFn: async () => {
      const r = await fetch(withQuery("/api/smart-goals"));
      const json = await r.json();
      if (!r.ok || json.error) {
        throw new Error(json.error || "Não foi possível carregar metas inteligentes.");
      }
      return json;
    },
    enabled: !isAggregated,
    staleTime: 120_000,
    refetchInterval: 120_000,
  });

  if (isAggregated) {
    return (
      <ModuleShell
        title="Metas Inteligentes"
        subtitle="Centro de planejamento operacional baseado no seu histórico real"
      >
        <BusinessWriteNotice message={goalsBlockedMessage} />
      </ModuleShell>
    );
  }

  if (isError) {
    return (
      <ModuleShell
        title="Metas Inteligentes"
        subtitle="Centro de planejamento operacional baseado no seu histórico real"
      >
        <EmptyModuleState
          icon={Target}
          title="Não foi possível carregar as metas"
          description={
            error instanceof Error
              ? error.message
              : "Tente novamente em instantes."
          }
          onRetry={() => void refetch()}
        />
      </ModuleShell>
    );
  }

  if (isLoading || !view) {
    return (
      <ModuleShell
        title="Metas Inteligentes"
        subtitle="Centro de planejamento operacional baseado no seu histórico real"
      >
        <PageLoader />
      </ModuleShell>
    );
  }

  return (
    <ModuleShell
      title="Metas Inteligentes"
      subtitle="Centro de planejamento operacional baseado no seu histórico real"
    >
      <SmartGoalsDashboard view={view} />
    </ModuleShell>
  );
}
