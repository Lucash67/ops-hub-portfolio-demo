"use client";

import { CreateBusinessOnboarding } from "@/components/onboarding/create-business-onboarding";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/loading";
import { useOwnedBusinesses } from "@/hooks/use-owned-businesses";
import { useQueryClient } from "@tanstack/react-query";

interface TenantWorkspaceGateProps {
  children: React.ReactNode;
}

/** Blocks module content until business context matches the signed-in account. */
export function TenantWorkspaceGate({ children }: TenantWorkspaceGateProps) {
  const queryClient = useQueryClient();
  const { isError, error, isEmpty, isReady, refetch } = useOwnedBusinesses();

  if (isError) {
    return (
      <div className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-8 text-center space-y-4">
        <p className="text-text-primary">
          {error instanceof Error ? error.message : "Não foi possível carregar suas operações."}
        </p>
        <Button
          onClick={() => {
            void refetch();
            void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
          }}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!isReady) {
    return <PageLoader />;
  }

  if (isEmpty) {
    return (
      <div className="py-4">
        <CreateBusinessOnboarding />
      </div>
    );
  }

  return <>{children}</>;
}
