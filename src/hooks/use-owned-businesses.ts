"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ALL_BUSINESSES_ID } from "@/lib/business-units";
import { useSessionUser } from "@/hooks/use-session-user";
import {
  useActiveBusinessId,
  useBusinessContextStore,
  type BusinessesApiResponse,
} from "@/stores/business-context-store";

export function useOwnedBusinesses() {
  const { data: user, isFetched: sessionFetched } = useSessionUser();
  const activeBusinessId = useActiveBusinessId();
  const setActiveBusiness = useBusinessContextStore((s) => s.setActiveBusiness);
  const setOwnerUserId = useBusinessContextStore((s) => s.setOwnerUserId);
  const ownerUserId = useBusinessContextStore((s) => s.ownerUserId);
  const resetBusinessContext = useBusinessContextStore((s) => s.resetBusinessContext);
  const realUserId = user?.id && user.id !== "local" ? user.id : null;

  // Cookie auth is enough — do not wait for realUserId (avoids infinite PageLoader).
  const query = useQuery<BusinessesApiResponse>({
    queryKey: ["businesses", realUserId ?? "cookie"],
    queryFn: async () => {
      const r = await fetch("/api/businesses", { credentials: "include" });
      const json = await r.json();
      if (!r.ok || json.error) {
        throw new Error(json.error || "Não foi possível carregar as operações.");
      }
      return json;
    },
    staleTime: 120_000,
    retry: 1,
  });

  const units = query.data?.units ?? [];

  const effectiveBusinessId = useMemo(() => {
    if (!query.data) return null;
    if (units.length === 0) return ALL_BUSINESSES_ID;
    if (
      activeBusinessId === ALL_BUSINESSES_ID ||
      units.some((u) => u.id === activeBusinessId)
    ) {
      return activeBusinessId;
    }
    return units[0]!.id;
  }, [query.data, units, activeBusinessId]);

  useEffect(() => {
    if (!realUserId) return;
    if (ownerUserId && ownerUserId !== realUserId) {
      resetBusinessContext(realUserId);
      return;
    }
    if (ownerUserId !== realUserId) {
      setOwnerUserId(realUserId);
    }
  }, [realUserId, ownerUserId, resetBusinessContext, setOwnerUserId]);

  useEffect(() => {
    if (effectiveBusinessId && effectiveBusinessId !== activeBusinessId) {
      setActiveBusiness(effectiveBusinessId);
    }
  }, [effectiveBusinessId, activeBusinessId, setActiveBusiness]);

  const isSynced = effectiveBusinessId != null;

  return {
    ...query,
    units,
    isEmpty: Boolean(query.data && units.length === 0),
    isSynced,
    isReady: Boolean(query.data && isSynced),
    sessionFetched,
  };
}
