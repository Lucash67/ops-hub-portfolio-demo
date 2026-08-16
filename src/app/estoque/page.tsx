"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ModuleShell } from "@/components/layout/module-shell";
import { BusinessWriteNotice } from "@/components/business/business-write-notice";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/loading";
import { EmptyModuleState } from "@/components/ui/empty-module-state";
import { AlertTriangle, ArrowDown, ArrowUp, Package } from "lucide-react";
import { motion } from "framer-motion";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { fetchJson } from "@/lib/api/safe-json";

interface StockData {
  products: Array<{ id: string; name: string; stockQuantity: number; minStock: number; category: string }>;
  movements: Array<{ id: string; type: string; quantity: number; balanceAfter: number; reason: string; createdAt: string; product: { name: string } }>;
  lowStock: Array<{ id: string; name: string; stockQuantity: number; minStock: number }>;
}

export default function EstoquePage() {
  const queryClient = useQueryClient();
  const { activeBusinessId, canWrite, withQuery, writeBlockedMessage } = useBusinessScope();
  const [form, setForm] = useState({ productId: "", type: "entry", quantity: "", reason: "" });
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<StockData>({
    queryKey: ["stock", activeBusinessId],
    queryFn: async () => (await fetchJson(withQuery("/api/stock"))) as StockData,
    staleTime: 120_000,
  });

  const updateStock = useMutation({
    mutationFn: async (payload: typeof form) => {
      const r = await fetch(withQuery("/api/stock"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (!r.ok || json.error) throw new Error(json.error || "Não foi possível registrar a movimentação.");
      return json;
    },
    onSuccess: () => {
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setForm({ ...form, quantity: "", reason: "" });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  if (isError) {
    return (
      <ModuleShell title="Estoque" subtitle="Controle de entrada, saída e saldo">
        <p className="text-text-muted mb-3">
          {error instanceof Error ? error.message : "Não foi possível carregar o estoque."}
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
      </ModuleShell>
    );
  }

  if (isLoading || !data) {
    return (
      <ModuleShell title="Estoque" subtitle="Controle de entrada, saída e saldo">
        <PageLoader />
      </ModuleShell>
    );
  }

  const totalStock = data.products.reduce((s, p) => s + p.stockQuantity, 0);

  return (
    <ModuleShell title="Estoque" subtitle="Controle de entrada, saída e saldo">
      <div className="space-y-6">
        {!canWrite && <BusinessWriteNotice message={writeBlockedMessage} />}

        {data.products.length === 0 ? (
          <EmptyModuleState
            icon={Package}
            title="Nenhum produto no estoque"
            description="Cadastre produtos na operação para controlar saldo, entradas e saídas."
            actionHref="/produtos"
            actionLabel="Ir para produtos"
            compact
          />
        ) : null}

        {data.lowStock.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-brand-red/30 bg-brand-red/5">
              <div className="flex items-center gap-3 p-4">
                <AlertTriangle className="h-5 w-5 text-brand-red" />
                <div>
                  <p className="font-semibold text-brand-red">Estoque Baixo — Reposição Necessária</p>
                  <p className="text-sm text-text-secondary">
                    {data.lowStock.map((p) => `${p.name} (${p.stockQuantity}/${p.minStock})`).join(" · ")}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <Card className="p-4 sm:p-5">
            <p className="text-sm text-text-muted">Saldo Total</p>
            <p className="text-2xl font-bold text-text-primary sm:text-3xl">{totalStock}</p>
          </Card>
          <Card className="p-4 sm:p-5">
            <p className="text-sm text-text-muted">Produtos</p>
            <p className="text-2xl font-bold text-text-primary sm:text-3xl">{data.products.length}</p>
          </Card>
          <Card className="col-span-2 p-4 sm:col-span-1 sm:p-5">
            <p className="text-sm text-text-muted">Alertas</p>
            <p className="text-2xl font-bold text-brand-red sm:text-3xl">{data.lowStock.length}</p>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Movimentação de Estoque</CardTitle></CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!canWrite) {
                  setFormError(writeBlockedMessage);
                  return;
                }
                updateStock.mutate(form);
              }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <Select label="Produto" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required disabled={!canWrite}>
                <option value="">Selecione</option>
                {data.products.map((p) => <option key={p.id} value={p.id}>{p.name} (saldo: {p.stockQuantity})</option>)}
              </Select>
              <Select label="Tipo" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} disabled={!canWrite}>
                <option value="entry">Entrada</option>
                <option value="exit">Saída</option>
                <option value="adjustment">Ajuste</option>
              </Select>
              <Input label="Quantidade" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required disabled={!canWrite} />
              <Input label="Motivo" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} disabled={!canWrite} />
              {formError && <p className="text-sm text-brand-red sm:col-span-2 lg:col-span-4">{formError}</p>}
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!canWrite || updateStock.isPending}>
                  Registrar Movimentação
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Produtos em Estoque</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.products.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-elevated p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Package className="h-4 w-4 shrink-0 text-text-muted" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="truncate text-xs text-text-muted">{p.category}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-bold ${p.stockQuantity <= p.minStock ? "text-brand-red" : "text-text-primary"}`}>{p.stockQuantity}</p>
                    <p className="text-xs text-text-muted">mín: {p.minStock}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
            <CardContent className="space-y-2 lg:max-h-96 lg:overflow-y-auto">
              {data.movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-elevated p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {m.type === "entry" ? (
                      <ArrowUp className="h-4 w-4 shrink-0 text-brand-green" />
                    ) : (
                      <ArrowDown className="h-4 w-4 shrink-0 text-brand-red" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.product?.name}</p>
                      <p className="truncate text-xs text-text-muted">{m.reason || m.type}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant={m.type === "entry" ? "success" : "error"}>
                      {m.type === "entry" ? "+" : "-"}{m.quantity}
                    </Badge>
                    <p className="text-xs text-text-muted mt-1">Saldo: {m.balanceAfter}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </ModuleShell>
  );
}
