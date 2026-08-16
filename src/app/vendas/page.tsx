"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ModuleShell } from "@/components/layout/module-shell";
import { BusinessWriteNotice } from "@/components/business/business-write-notice";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/loading";
import { Plus, ShoppingCart, Package } from "lucide-react";
import { formatCurrency, formatDateTime, paymentMethodLabel, todayISO, nowTime, DEPARTMENTS, PAYMENT_METHODS } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { asArray, fetchJsonArray } from "@/lib/api/safe-json";
import { filterByTemporalContext } from "@/lib/temporal-filter";
import { useTemporalViewContext } from "@/stores/temporal-context-store";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stockQuantity: number;
  status: string;
}

interface Client {
  id: string;
  name: string;
  sector: string;
}

interface Sale {
  id: string;
  date: string;
  time: string;
  totalAmount: number;
  profit: number;
  paymentMethod: string;
  department: string;
  client: Client | null;
  items: Array<{ product: Product; quantity: number; subtotal: number }>;
}

async function postJson(url: string, data: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await r.json();
  if (!r.ok || json.error) {
    throw new Error(json.error || json.message || "Não foi possível concluir a operação.");
  }
  return json;
}

export default function VendasPage() {
  const queryClient = useQueryClient();
  const context = useTemporalViewContext();
  const { activeBusinessId, canWrite, withQuery, writeBlockedMessage } = useBusinessScope();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    clientId: "",
    department: "",
    productId: "",
    quantity: "1",
    paymentMethod: "pix",
    notes: "",
  });

  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["sales", activeBusinessId],
    queryFn: () => fetchJsonArray<Sale>(withQuery("/api/sales")),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products", activeBusinessId],
    queryFn: () => fetchJsonArray<Product>(withQuery("/api/products")),
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients", activeBusinessId],
    queryFn: () => fetchJsonArray<Client>(withQuery("/api/clients")),
  });

  const activeProducts = products.filter((p) => p.status === "active");

  const filteredSales = useMemo(
    () => filterByTemporalContext(asArray<Sale>(sales), context),
    [sales, context],
  );

  const createSale = useMutation({
    mutationFn: (data: typeof form) =>
      postJson("/api/sales", {
        ...data,
        businessId: activeBusinessId,
        date: todayISO(),
        time: nowTime(),
      }),
    onSuccess: () => {
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-view"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setShowForm(false);
      setForm({ clientId: "", department: "", productId: "", quantity: "1", paymentMethod: "pix", notes: "" });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const selectedProduct = activeProducts.find((p) => p.id === form.productId);
  const previewTotal = selectedProduct ? selectedProduct.price * Number(form.quantity) : 0;

  function handleNewSale() {
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
      <ModuleShell title="Vendas" subtitle="Registre e acompanhe suas vendas">
        <PageLoader />
      </ModuleShell>
    );
  }

  return (
    <ModuleShell title="Vendas" subtitle="Registre e acompanhe suas vendas">
      <div className="space-y-6">
        {!canWrite && <BusinessWriteNotice message={writeBlockedMessage} />}

        <div className="flex justify-between items-center">
          <p className="text-text-secondary">{filteredSales.length} vendas no período</p>
          <Button onClick={handleNewSale} disabled={!canWrite || activeProducts.length === 0}>
            <Plus className="h-4 w-4" />
            Nova Venda
          </Button>
        </div>

        {canWrite && activeProducts.length === 0 && (
          <Card className="p-8 text-center">
            <Package className="h-10 w-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary mb-4">Cadastre pelo menos um produto ativo nesta operação antes de registrar vendas.</p>
            <Link href="/produtos">
              <Button variant="secondary">Ir para Produtos</Button>
            </Link>
          </Card>
        )}

        <AnimatePresence>
          {showForm && canWrite && activeProducts.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle>Registrar Venda</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      createSale.mutate(form);
                    }}
                    className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    <Select label="Produto" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
                      <option value="">Selecione</option>
                      {activeProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatCurrency(p.price)} (estoque: {p.stockQuantity})
                        </option>
                      ))}
                    </Select>
                    <Input label="Quantidade" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
                    <Select label="Forma de Pagamento" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </Select>
                    <Select label="Cliente (opcional)" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                      <option value="">Sem cliente</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                    <Select label="Departamento (opcional)" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                      <option value="">Não informado</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </Select>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <Textarea label="Observações (opcional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </div>
                    {previewTotal > 0 && (
                      <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between rounded-xl bg-brand-orange/10 p-4">
                        <span className="text-sm text-text-secondary">Total da venda</span>
                        <span className="text-xl font-bold text-brand-orange">{formatCurrency(previewTotal)}</span>
                      </div>
                    )}
                    {formError && (
                      <p className="sm:col-span-2 lg:col-span-3 text-sm text-brand-red">{formError}</p>
                    )}
                    <div className="sm:col-span-2 lg:col-span-3 flex gap-3">
                      <Button type="submit" disabled={createSale.isPending || !form.productId}>
                        {createSale.isPending ? "Salvando..." : "Salvar Venda"}
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {sales && filteredSales.length === 0 && activeProducts.length > 0 && (
          <Card className="p-8 text-center">
            <ShoppingCart className="h-10 w-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary">Nenhuma venda registrada nesta operação. Clique em Nova Venda para começar.</p>
          </Card>
        )}

        <div className="space-y-3">
          {filteredSales.slice(0, 50).map((sale, i) => (
            <motion.div
              key={sale.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
            >
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/10">
                      <ShoppingCart className="h-5 w-5 text-brand-orange" />
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">
                        {sale.items?.map((item) => `${item.quantity}x ${item.product?.name}`).join(", ") || "Venda"}
                      </p>
                      <p className="text-xs text-text-muted">
                        {formatDateTime(sale.date, sale.time)}
                        {sale.client && ` · ${sale.client.name}`}
                        {sale.department && ` · ${sale.department}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-text-primary">{formatCurrency(sale.totalAmount)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="success">+{formatCurrency(sale.profit)}</Badge>
                      <Badge>{paymentMethodLabel(sale.paymentMethod)}</Badge>
                    </div>
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
