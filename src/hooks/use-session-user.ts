"use client";

import { useQuery } from "@tanstack/react-query";
import { getHubSession, markHubSession } from "@/lib/hub-session";

export interface SessionUserPublic {
  id: string;
  email: string;
  name: string;
}

function readLocalSessionUser(): SessionUserPublic | null {
  const local = getHubSession();
  if (!local?.email) return null;
  return {
    id: "local",
    email: local.email,
    name: local.name?.trim() || "Lucas",
  };
}

export function useSessionUser() {
  return useQuery<SessionUserPublic | null>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const json = (await res.json()) as { user?: SessionUserPublic };
        if (json.user) {
          markHubSession({ email: json.user.email, name: json.user.name });
          return json.user;
        }
      }
      return null;
    },
    // Display-only fallback — must NOT block /api/auth/me (never use as settled initialData).
    placeholderData: () => readLocalSessionUser(),
    staleTime: 60_000,
    retry: 1,
  });
}
