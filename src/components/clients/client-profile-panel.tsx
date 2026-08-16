"use client";

import type { ComponentType } from "react";
import { formatCurrency, formatDate, formatDateTime, paymentMethodLabel } from "@/lib/utils";
import { SectionPanel } from "@/components/executive/section-panel";
import { ClientBadgeChip } from "./client-badge";
import type { ClientCrmProfile } from "@/lib/client-crm-service";
import {
  Calendar,
  Clock,
  CreditCard,
  Lightbulb,
  ShoppingBag,
  Target,
  TrendingDown,
  TrendingUp,
  Minus,
  Receipt,
  Repeat,
  Sparkles,
} from "lucide-react";
import { cn } from "@/components/ui/utils";

interface ClientProfilePanelProps {
  profile: ClientCrmProfile;
}

function TrendIcon({ trend }: { trend: ClientCrmProfile["behavior"]["trend"] }) {
  if (trend === "growing") return <TrendingUp className="h-4 w-4 text-brand-green" />;
  if (trend === "declining") return <TrendingDown className="h-4 w-4 text-brand-red" />;
  if (trend === "stable") return <Minus className="h-4 w-4 text-text-muted" />;
  return <Minus className="h-4 w-4 text-text-muted" />;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-elevated p-3">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-text-muted" />
        <p className="label-upper">{label}</p>
      </div>
      <p className={cn("truncate text-base font-bold sm:text-lg", accent && "text-blue-400")} title={value}>
        {value}
      </p>
    </div>
  );
}

export function ClientProfilePanel({ profile }: ClientProfilePanelProps) {
  const { client, summary, behavior, relationship, timeline, insights, suggestedAction } = profile;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="rounded-2xl border border-blue-500/20 bg-surface-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
          <h2 className="text-lg font-bold text-text-primary sm:text-xl">{client.name}</h2>
          {summary.badge && <ClientBadgeChip badge={summary.badge} />}
        </div>
        <p className="text-sm text-text-muted">
          {[client.sector, client.company].filter(Boolean).join(" · ") || "Sem setor cadastrado"}
          {client.phone ? ` · ${client.phone}` : ""}
        </p>
      </div>

      <SectionPanel theme="clients" title="Resumo">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
          <MetricCard label="Total gasto" value={formatCurrency(summary.totalReceived)} icon={ShoppingBag} accent />
          <MetricCard label="Compras" value={String(summary.purchaseCount)} icon={Repeat} />
          <MetricCard label="Ticket médio" value={formatCurrency(summary.averageTicket)} icon={Receipt} />
          <MetricCard
            label="Última compra"
            value={summary.lastPurchaseRelative}
            icon={Calendar}
          />
          <MetricCard
            label="Dias sem comprar"
            value={summary.daysSinceLastPurchase != null ? String(summary.daysSinceLastPurchase) : "—"}
            icon={Clock}
          />
          <MetricCard label="Produto favorito" value={summary.favoriteProduct} icon={Sparkles} />
        </div>
        {summary.pendingAmount > 0 && (
          <p className="mt-3 rounded-lg border border-brand-orange/20 bg-brand-orange/5 px-3 py-2 text-sm text-brand-orange">
            Pagamento pendente: {formatCurrency(summary.pendingAmount)}
          </p>
        )}
      </SectionPanel>

      <SectionPanel theme="clients" title="Comportamento">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <MetricCard
            label="Turno preferido"
            value={behavior.preferredHour ?? "—"}
            icon={Clock}
          />
          <MetricCard
            label="Dia preferido"
            value={behavior.preferredWeekday ?? "—"}
            icon={Calendar}
          />
          <MetricCard
            label="Qtd. média por compra"
            value={String(behavior.averageQuantityPerPurchase)}
            icon={ShoppingBag}
          />
          <MetricCard
            label="Pagamento favorito"
            value={behavior.preferredPaymentLabel}
            icon={CreditCard}
          />
          <div className="col-span-2 rounded-xl border border-surface-border bg-surface-elevated p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <TrendIcon trend={behavior.trend} />
              <p className="label-upper">Tendência</p>
            </div>
            <p className="text-lg font-bold">{behavior.trendLabel}</p>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel theme="clients" title="Relacionamento">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <MetricCard
            label="Primeira compra"
            value={relationship.firstPurchaseDate ? formatDate(relationship.firstPurchaseDate) : "—"}
            icon={Calendar}
          />
          <MetricCard
            label="Última compra"
            value={relationship.lastPurchaseDate ? formatDate(relationship.lastPurchaseDate) : "—"}
            icon={Calendar}
          />
          <MetricCard
            label="Tempo como cliente"
            value={`${relationship.daysAsCustomer} dias`}
            icon={Clock}
          />
          <MetricCard
            label="Frequência"
            value={relationship.purchaseFrequencyLabel}
            icon={Repeat}
          />
          <MetricCard
            label="Participação na receita"
            value={`${relationship.revenueSharePercent.toFixed(1).replace(".", ",")}%`}
            icon={Target}
          />
        </div>
      </SectionPanel>

      <SectionPanel theme="clients" title="Timeline de compras">
        {timeline.length === 0 ? (
          <p className="rounded-xl bg-surface-elevated px-4 py-6 text-center text-sm text-text-muted">
            Nenhuma compra registrada para este cliente.
          </p>
        ) : (
          <div className="relative space-y-0">
            {timeline.map((sale, index) => (
              <div key={sale.id} className="relative flex gap-3 pb-4 last:pb-0 sm:gap-4 sm:pb-5">
                {index < timeline.length - 1 && (
                  <span className="absolute left-[11px] top-6 h-[calc(100%-8px)] w-px bg-surface-border" />
                )}
                <div className="relative z-10 mt-1 h-[22px] w-[22px] shrink-0 rounded-full border-2 border-blue-500/40 bg-blue-500/10" />
                <div className="min-w-0 flex-1 rounded-xl border border-surface-border bg-surface-elevated p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary">
                        {formatDateTime(sale.date, sale.time)}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {paymentMethodLabel(sale.paymentMethod)}
                        {sale.paymentStatus === "pending" ? " · Pendente" : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-blue-400">{formatCurrency(sale.totalAmount)}</p>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {sale.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="text-xs text-text-secondary">
                        {item.quantity}× {item.productName} · {formatCurrency(item.subtotal)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionPanel>

      <SectionPanel theme="clients" title="Insights do cliente">
        {insights.length === 0 ? (
          <p className="text-sm text-text-muted">Ainda não há insights — registre mais compras.</p>
        ) : (
          <ul className="space-y-2">
            {insights.map((insight) => (
              <li
                key={insight.id}
                className="flex items-start gap-2 rounded-xl border border-surface-border bg-surface-elevated px-3 py-2.5 text-sm text-text-secondary"
              >
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                {insight.text}
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>

      {suggestedAction && (
        <SectionPanel theme="clients" title="Próxima ação">
          <div
            className={cn(
              "rounded-xl border p-4",
              suggestedAction.priority === "high"
                ? "border-brand-orange/30 bg-brand-orange/5"
                : "border-blue-500/20 bg-blue-500/5",
            )}
          >
            <p className="font-semibold text-text-primary">{suggestedAction.title}</p>
            <p className="mt-1 text-sm text-text-secondary">{suggestedAction.description}</p>
          </div>
        </SectionPanel>
      )}
    </div>
  );
}
