"use client";

import { cn } from "@/components/ui/utils";
import { formatCurrency } from "@/lib/utils";
import { User } from "lucide-react";
import { ClientBadgeChip } from "./client-badge";
import type { ClientCrmListItem } from "@/lib/client-crm-service";
import type { ClientFilterId } from "@/lib/client-crm-view";
import { matchesClientFilter, sortClientsForFilter } from "@/lib/client-crm-view";

export const CLIENT_FILTERS: Array<{ id: ClientFilterId; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "vip", label: "VIP" },
  { id: "recorrentes", label: "Recorrentes" },
  { id: "novos", label: "Novos" },
  { id: "inativos", label: "Inativos" },
  { id: "maior_faturamento", label: "Maior faturamento" },
  { id: "maior_frequencia", label: "Maior frequência" },
];

interface ClientListPanelProps {
  clients: ClientCrmListItem[];
  selectedId: string | null;
  filter: ClientFilterId;
  search: string;
  onSelect: (id: string) => void;
  onFilterChange: (filter: ClientFilterId) => void;
  onSearchChange: (value: string) => void;
}

function matchesSearch(client: ClientCrmListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    client.name.toLowerCase().includes(q) ||
    (client.phone ?? "").toLowerCase().includes(q) ||
    client.favoriteProduct.toLowerCase().includes(q)
  );
}

export function filterClientList(
  clients: ClientCrmListItem[],
  filter: ClientFilterId,
  search: string,
): ClientCrmListItem[] {
  const filtered = clients.filter(
    (client) => matchesClientFilter(client.badge, client, filter) && matchesSearch(client, search),
  );
  return sortClientsForFilter(filtered, filter);
}

export function ClientListPanel({
  clients,
  selectedId,
  filter,
  search,
  onSelect,
  onFilterChange,
  onSearchChange,
}: ClientListPanelProps) {
  const visible = filterClientList(clients, filter, search);

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Buscar por nome, produto ou telefone..."
        className="h-11 w-full rounded-xl border border-surface-border bg-surface-elevated px-3 py-2 text-base text-text-primary placeholder:text-text-muted focus:border-blue-500/40 focus:outline-none sm:h-10 sm:text-sm"
      />

      <div className="flex flex-wrap gap-1.5">
        {CLIENT_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onFilterChange(item.id)}
            className={cn(
              "min-h-[34px] rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors sm:min-h-0 sm:py-1",
              filter === item.id
                ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                : "border-surface-border bg-surface-elevated text-text-secondary hover:text-text-primary",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-text-muted">
        {visible.length} de {clients.length} clientes
      </p>

      {/* No celular a lista rola com a página; no desktop fica com scroll próprio. */}
      <div className="space-y-2 lg:max-h-[62vh] lg:overflow-y-auto lg:pr-1">
        {visible.map((client) => (
          <button
            key={client.id}
            type="button"
            onClick={() => onSelect(client.id)}
            className={cn(
              "w-full rounded-xl border p-3 text-left transition-all hover:shadow-card",
              selectedId === client.id
                ? "border-blue-500/40 bg-blue-500/5"
                : "border-surface-border bg-surface-card hover:border-surface-border/80",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
                <User className="h-4 w-4 text-text-secondary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-text-primary">{client.name}</p>
                  {client.badge && <ClientBadgeChip badge={client.badge} compact />}
                </div>
                <p className="mt-0.5 text-xs text-text-muted">
                  Última compra · {client.lastPurchaseRelative}
                </p>
                <p className="mt-1 text-xs font-semibold text-blue-400">
                  {formatCurrency(client.totalSpent)}
                  {client.purchaseCount > 0 && (
                    <span className="font-normal text-text-muted"> · {client.purchaseCount} compras</span>
                  )}
                </p>
              </div>
            </div>
          </button>
        ))}

        {visible.length === 0 && (
          <p className="rounded-xl bg-surface-elevated px-4 py-6 text-center text-sm text-text-muted">
            Nenhum cliente encontrado com este filtro.
          </p>
        )}
      </div>
    </div>
  );
}
