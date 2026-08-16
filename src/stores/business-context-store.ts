import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ALL_BUSINESSES_ID,
  getBusinessUnitName,
  type BusinessUnit,
} from "@/lib/business-units";

export interface BusinessContextState {
  activeBusinessId: string;
  /** Prevents leaking another account's selected operation via localStorage. */
  ownerUserId: string | null;
  setActiveBusiness: (businessId: string) => void;
  setOwnerUserId: (userId: string | null) => void;
  resetBusinessContext: (userId?: string | null) => void;
}

export const useBusinessContextStore = create<BusinessContextState>()(
  persist(
    (set) => ({
      activeBusinessId: ALL_BUSINESSES_ID,
      ownerUserId: null,
      setActiveBusiness: (businessId) => set({ activeBusinessId: businessId }),
      setOwnerUserId: (userId) => set({ ownerUserId: userId }),
      resetBusinessContext: (userId = null) =>
        set({ activeBusinessId: ALL_BUSINESSES_ID, ownerUserId: userId }),
    }),
    {
      name: "lbo-business-context",
      version: 2,
      migrate: () => ({
        activeBusinessId: ALL_BUSINESSES_ID,
        ownerUserId: null,
      }),
    },
  ),
);

export function useActiveBusinessId(): string {
  return useBusinessContextStore((s) => s.activeBusinessId);
}

export function formatBusinessSelectorLabel(businessId: string): string {
  return getBusinessUnitName(businessId);
}

export interface BusinessesApiResponse {
  all: { id: string; name: string };
  units: BusinessUnit[];
}
