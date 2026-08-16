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
import { Plus, Package } from "lucide-react";
import { formatCurrency, PRODUCT_CATEGORIES } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { fetchJsonArray } from "@/lib/api/safe-json";

async function postJson(url: string, data: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await r.json();
  if (!r.ok || json.error) {
    throw new Error(json.error || "Não foi possível concluir a operação.");
  }
  return json;
}

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  soldQuantity: number;
  revenueGenerated: number;
  salesShare: number;
  lastSaleDate: string | null;
  status: string;
}

export default function ProdutosPage() {
  const queryClient = useQueryClient();
  const { activeBusinessId, canWrite, withQuery, writeBlockedMessage } = useBusinessScope();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "Salgados",
    price: "",
    cost: "",
    stockQuantity: "0",
    minStock: "0",
    status: "active",
  });

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products", activeBusinessId],
    queryFn: () => fetchJsonArray<Product>(withQuery("/api/products")),
  });

  const createProduct = useMutation({
    mutationFn: (data: typeof form) =>
      postJson("/api/products", { ...data, businessId: activeBusinessId }),
    onSuccess: () => {
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      setShowForm(false);
      setForm({ name: "", category: "Salgados", price: "", cost: "", stockQuantity: "0", minStock: "0", status: "active" });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  function handleNewProduct() {
    if (!canWrite) {
      setFormError(writeBlockedMessage);
      setShowForm(false);
      return;
    }
    setFormError(null);
    setShowForm(!showForm);
  }

  if (isLoading) {
    return (
      <ModuleShell title="Produtos" subtitle="Gerencie seu catálogo de produtos">
        <PageLoader />
      </ModuleShell>
    );
  }

  return (
    <ModuleShell title="Produtos" subtitle="Gerencie seu catálogo de produtos">
      <div className="space-y-6">
        {!canWrite && <BusinessWriteNotice message={writeBlockedMessage} />}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-text-secondary">{products?.length ?? 0} produtos cadastrados</p>
          <Button onClick={handleNewProduct} disabled={!canWrite}>
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        </div>

        <AnimatePresence>
          {showForm && canWrite && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Card>
                <CardHeader><CardTitle>Cadastrar Produto</CardTitle></CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => { e.preventDefault(); createProduct.mutate(form); }}
                    className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    <Input label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    <Select label="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                    <Input label="Preço (R$)" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                    <Input label="Custo (R$)" type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} required />
                    {formError && <p className="sm:col-span-2 lg:col-span-3 text-sm text-brand-red">{formError}</p>}
                    <div className="flex gap-3 sm:col-span-2 lg:col-span-3">
                      <Button type="submit" size="lg" className="flex-1 sm:flex-none" disabled={createProduct.isPending}>
                        Salvar
                      </Button>
                      <Button type="button" size="lg" variant="secondary" onClick={() => setShowForm(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {products && products.length === 0 && !showForm && (
          <Card className="p-6 text-center sm:p-8">
            <Package className="h-10 w-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary mb-4">Nenhum produto cadastrado nesta operação.</p>
            {canWrite && (
              <Button onClick={handleNewProduct}>Cadastrar primeiro produto</Button>
            )}
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products?.map((product, i) => (
            <motion.div key={product.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-orange/10">
                    <Package className="h-6 w-6 text-brand-orange" />
                  </div>
                  <Badge variant={product.status === "active" ? "success" : "default"}>
                    {product.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <h3 className="truncate text-lg font-semibold text-text-primary">{product.name}</h3>
                <p className="mb-4 text-xs text-text-muted">{product.category}</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
                  <div>
                    <p className="text-text-muted text-xs">Preço</p>
                    <p className="font-semibold">{formatCurrency(product.price)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Custo</p>
                    <p className="font-semibold">{formatCurrency(product.cost)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Lucro/un</p>
                    <p className="font-semibold text-brand-green">{formatCurrency(product.price - product.cost)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Vendidos</p>
                    <p className="font-semibold">{product.soldQuantity}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Receita gerada</p>
                    <p className="font-semibold text-brand-orange">{formatCurrency(product.revenueGenerated)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Participação</p>
                    <p className="font-semibold">{product.salesShare.toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Última venda</p>
                    <p className="font-semibold">
                      {product.lastSaleDate
                        ? format(parseISO(product.lastSaleDate), "dd/MM/yyyy")
                        : "—"}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </ModuleShell>
  );
}
