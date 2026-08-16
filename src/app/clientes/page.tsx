"use client";

import { useState } from "react";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { fetchJson, fetchJsonArray } from "@/lib/api/safe-json";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ModuleShell } from "@/components/layout/module-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/loading";
import { EmptyModuleState } from "@/components/ui/empty-module-state";
import { SectionPanel } from "@/components/executive/section-panel";
import { ClientListPanel } from "@/components/clients/client-list-panel";
import { ClientProfilePanel } from "@/components/clients/client-profile-panel";
import { ArrowLeft, Plus, User } from "lucide-react";
import { cn, DEPARTMENTS } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { ClientCrmListItem, ClientCrmProfile } from "@/lib/client-crm-service";
import type { ClientFilterId } from "@/lib/client-crm-view";

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

export default function ClientesPage() {
  const queryClient = useQueryClient();
  const { activeBusinessId, withQuery } = useBusinessScope();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ClientFilterId>("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", sector: "", company: "", phone: "", notes: "" });

  const { data: clients = [], isLoading, isError, error, refetch } = useQuery<ClientCrmListItem[]>({
    queryKey: ["clients", activeBusinessId],
    queryFn: () => fetchJsonArray<ClientCrmListItem>(withQuery("/api/clients")),
  });

  const {
    data: profile,
    isError: isProfileError,
    error: profileError,
  } = useQuery<ClientCrmProfile>({
    queryKey: ["client-details", selectedId, activeBusinessId],
    queryFn: async () =>
      (await fetchJson(withQuery(`/api/clients?id=${selectedId}`))) as ClientCrmProfile,
    enabled: !!selectedId,
  });

  const createClient = useMutation({
    mutationFn: (data: typeof form) => postJson("/api/clients", { ...data, businessId: activeBusinessId }),
    onSuccess: () => {
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setShowForm(false);
      setForm({ name: "", sector: "", company: "", phone: "", notes: "" });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  if (isError) {
    return (
      <ModuleShell title="Clientes">
        <EmptyModuleState
          icon={User}
          title="Não foi possível carregar os clientes"
          description={error instanceof Error ? error.message : "Tente novamente em instantes."}
          onRetry={() => void refetch()}
        />
      </ModuleShell>
    );
  }

  if (isLoading) {
    return (
      <ModuleShell title="Clientes">
        <PageLoader />
      </ModuleShell>
    );
  }

  return (
    <ModuleShell title="Clientes" subtitle="CRM operacional — relacionamento e oportunidades">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">
            {clients?.length ?? 0} clientes · inteligência baseada em compras reais
          </p>
          <Button
            onClick={() => {
              setShowForm(!showForm);
              setFormError(null);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Cadastrar Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      createClient.mutate(form);
                    }}
                    className="grid gap-4 sm:grid-cols-2"
                  >
                    <Input
                      label="Nome"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      autoComplete="name"
                      autoCapitalize="words"
                      required
                    />
                    <Select
                      label="Setor"
                      value={form.sector}
                      onChange={(e) => setForm({ ...form, sector: e.target.value })}
                    >
                      <option value="">Selecione</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label="Empresa"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                    />
                    <Input
                      label="Telefone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                    <div className="sm:col-span-2">
                      <Textarea
                        label="Observações"
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      />
                    </div>
                    {formError && <p className="sm:col-span-2 text-sm text-brand-red">{formError}</p>}
                    <div className="flex gap-3 sm:col-span-2">
                      <Button type="submit" size="lg" className="flex-1 sm:flex-none">
                        Salvar
                      </Button>
                      <Button
                        type="button"
                        size="lg"
                        variant="secondary"
                        onClick={() => setShowForm(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {clients && clients.length === 0 && !showForm && (
          <Card className="p-8 text-center">
            <User className="h-10 w-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary mb-4">
              Nenhum cliente cadastrado. Registre quem compra com você.
            </p>
            <Button onClick={() => setShowForm(true)}>Cadastrar primeiro cliente</Button>
          </Card>
        )}

        {/* No celular é lista OU perfil (com voltar); no desktop, os dois lado a lado. */}
        <div className="grid gap-5 lg:grid-cols-3">
          <SectionPanel
            theme="clients"
            title="Clientes"
            className={cn("lg:col-span-1", selectedId && "hidden lg:block")}
          >
            <ClientListPanel
              clients={clients ?? []}
              selectedId={selectedId}
              filter={filter}
              search={search}
              onSelect={setSelectedId}
              onFilterChange={setFilter}
              onSearchChange={setSearch}
            />
          </SectionPanel>

          <div className={cn("space-y-3 lg:col-span-2", !selectedId && "hidden lg:block")}>
            {selectedId && (
              <Button
                variant="secondary"
                size="sm"
                className="lg:hidden"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar aos clientes
              </Button>
            )}
            {selectedId && isProfileError ? (
              <EmptyModuleState
                icon={User}
                title="Não foi possível carregar o perfil"
                description={
                  profileError instanceof Error
                    ? profileError.message
                    : "Tente selecionar o cliente novamente."
                }
                compact
              />
            ) : profile?.client ? (
              <ClientProfilePanel profile={profile} />
            ) : (
              <Card className="flex h-64 items-center justify-center border-dashed">
                <p className="text-text-muted">
                  {selectedId ? "Carregando perfil…" : "Selecione um cliente para ver o perfil CRM"}
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
