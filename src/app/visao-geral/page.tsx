"use client";

import { useQuery } from "@tanstack/react-query";
import { ModuleShell } from "@/components/layout/module-shell";
import { PageLoader } from "@/components/ui/loading";
import { VisaoGeralHero } from "@/components/visao-geral/visao-geral-hero";
import { OperationCards } from "@/components/visao-geral/operation-cards";
import { SystemMap } from "@/components/visao-geral/system-map";
import { MomentSuggestion } from "@/components/visao-geral/moment-suggestion";
import { useActiveBusinessId } from "@/stores/business-context-store";
import type { VisaoGeralPayload } from "@/lib/visao-geral";
import { HUB_COPY } from "@/constants/hub-brand";

export default function VisaoGeralPage() {
  const activeBusinessId = useActiveBusinessId();

  const { data, isLoading, isError, error } = useQuery<VisaoGeralPayload>({
    queryKey: ["visao-geral"],
    queryFn: async () => {
      const r = await fetch("/api/visao-geral", { credentials: "include" });
      const json = await r.json();
      if (!r.ok || json.error) {
        throw new Error(json.error || "Não foi possível carregar a visão geral.");
      }
      return json;
    },
    staleTime: 120_000,
    refetchInterval: 120_000,
  });

  if (isError) {
    return (
      <ModuleShell
        title="Visão Geral"
        subtitle="Centro de comando das suas operações"
        temporalFilter={false}
      >
        <div className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-5 text-center sm:p-8">
          <p className="text-text-primary">
            {error instanceof Error ? error.message : "Não foi possível carregar a visão geral."}
          </p>
        </div>
      </ModuleShell>
    );
  }

  if (isLoading || !data) {
    return (
      <ModuleShell
        title="Visão Geral"
        subtitle="Centro de comando das suas operações"
        temporalFilter={false}
      >
        <PageLoader />
      </ModuleShell>
    );
  }

  return (
    <ModuleShell
      title="Visão Geral"
      subtitle={`${HUB_COPY.productTagline} · ${HUB_COPY.holdingName}`}
      temporalFilter={false}
    >
      <div className="space-y-5 sm:space-y-6">
        <VisaoGeralHero operationCount={data.operations.length} />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <OperationCards
              operations={data.operations}
              consolidated={data.consolidated}
              activeBusinessId={activeBusinessId}
            />
          </div>
          <MomentSuggestion />
        </div>

        <SystemMap />

        <p className="pb-2 text-center text-[11px] text-text-muted">
          {HUB_COPY.footerSlogan}
        </p>
      </div>
    </ModuleShell>
  );
}
