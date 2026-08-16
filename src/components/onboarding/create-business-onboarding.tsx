"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBusinessContextStore } from "@/stores/business-context-store";
import type { BusinessUnit } from "@/lib/business-units";

interface CreateBusinessOnboardingProps {
  compact?: boolean;
}

export function CreateBusinessOnboarding({ compact = false }: CreateBusinessOnboardingProps) {
  const queryClient = useQueryClient();
  const setActiveBusiness = useBusinessContextStore((s) => s.setActiveBusiness);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (businessName: string) => {
      const r = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: businessName }),
      });
      const json = await r.json();
      if (!r.ok || json.error) {
        throw new Error(json.error || "Não foi possível criar a operação.");
      }
      return json.unit as BusinessUnit;
    },
    onSuccess: async (unit) => {
      setActiveBusiness(unit.id);
      await queryClient.invalidateQueries({ queryKey: ["businesses"] });
      await queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] !== "auth",
      });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Não foi possível criar a operação.");
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Informe o nome da sua operação.");
      return;
    }
    mutation.mutate(trimmed);
  }

  return (
    <Card className={compact ? "border-surface-border" : "mx-auto max-w-lg border-surface-border"}>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange">
          <Building2 className="h-5 w-5" />
        </div>
        <CardTitle className="text-xl">Criar minha operação</CardTitle>
        <p className="text-sm text-text-muted">
          Cada conta começa do zero. Dê um nome à sua primeira operação para registrar vendas,
          produtos e metas.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="business-name" className="text-sm font-medium text-text-secondary">
              Nome da operação
            </label>
            <Input
              id="business-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Salgados, Consultoria, Loja"
              maxLength={80}
              autoFocus={!compact}
              disabled={mutation.isPending}
            />
          </div>
          {error && <p className="text-sm text-brand-red">{error}</p>}
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Criando…" : "Criar operação"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
