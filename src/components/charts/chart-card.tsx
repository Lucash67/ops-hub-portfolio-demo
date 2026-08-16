"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { HUB_COLORS } from "@/constants/hub-brand";

const COLORS = [HUB_COLORS.yellow, "#22C55E", "#737373"];
const BRAND_PRIMARY = HUB_COLORS.yellow;

interface ChartCardProps {
  data: Array<{ label: string; value: number; profit?: number; revenue?: number }>;
  title: string;
  subtitle?: string;
  type?: "area" | "bar" | "pie";
  height?: number;
  showLegend?: boolean;
}

function formatTooltipValue(entry: { value: number; name?: string }): string {
  if (typeof entry.value !== "number") return String(entry.value);
  if (Math.abs(entry.value) >= 1 && (entry.value > 50 || entry.name?.includes("eceita") || entry.name?.includes("ucro"))) {
    return formatCurrency(entry.value);
  }
  return String(entry.value);
}

function formatTooltipLine(entry: { value: number; name?: string }): string {
  const label = entry.name && entry.name !== "value" ? entry.name : null;
  const formatted = formatTooltipValue(entry);
  return label ? `${label}: ${formatted}` : formatted;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-surface-border bg-surface-card px-3 py-2 shadow-card">
      <p className="mb-1 text-xs text-text-muted">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium text-text-primary">
          {formatTooltipLine(entry)}
        </p>
      ))}
    </div>
  );
}

/** Eixo Y curto: 1.250 vira "1,2k" e cabe nos 32px de largura no celular. */
function formatAxisValue(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 1000) return `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return String(Math.round(value));
}

export function ChartCard({ data, title, subtitle, type = "area", height = 260, showLegend }: ChartCardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const chartData = data.map((d) => ({
    name: d.label,
    value: d.value,
    profit: d.profit,
    revenue: d.revenue ?? d.value,
  }));

  return (
    <div className="card-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2 sm:mb-6">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
        </div>
        {type === "area" && showLegend && (
          <div className="flex items-center gap-3 text-xs text-text-muted sm:gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-orange" />
              Receita
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-green" />
              Lucro
            </span>
          </div>
        )}
      </div>
      {/* Altura menor no celular sem depender de JS: variável CSS + breakpoint. */}
      <div
        className="h-[210px] sm:h-[var(--chart-height)]"
        style={{ "--chart-height": `${height}px` } as React.CSSProperties}
      >
      {!mounted ? (
        <div className="h-full animate-pulse rounded-lg bg-surface-elevated" />
      ) : chartData.length === 0 ? (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface-elevated/30 px-4">
          <p className="text-center text-sm text-text-muted">Sem dados neste período — registre vendas para ver o gráfico.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          {type === "area" ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BRAND_PRIMARY} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={BRAND_PRIMARY} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#737373"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              <YAxis
                stroke="#737373"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={formatAxisValue}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke={BRAND_PRIMARY} fill="url(#gradRevenue)" strokeWidth={2} name="Receita" />
              {chartData.some((d) => d.profit !== undefined) && (
                <Area type="monotone" dataKey="profit" stroke="#22C55E" fill="url(#gradProfit)" strokeWidth={2} name="Lucro" />
              )}
            </AreaChart>
          ) : type === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#737373"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              <YAxis
                stroke="#737373"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={formatAxisValue}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" fill={BRAND_PRIMARY} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                stroke="none"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          )}
        </ResponsiveContainer>
      )}
      </div>
      {type === "pie" && mounted && (
        <div className="mt-4 space-y-2">
          {chartData.map((item, i) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-text-secondary">
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {item.name}
              </span>
              <span className="font-medium text-text-primary">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface TopProductsProps {
  products: Array<{ label: string; value: number }>;
  subtitle?: string;
}

export function TopProductsCard({ products, subtitle = "Este mês" }: TopProductsProps) {
  const max = Math.max(...products.map((p) => p.value), 1);

  return (
    <div className="card-surface p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h3 className="text-sm font-semibold text-text-primary">Top produtos</h3>
        <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
      </div>
      <div className="space-y-4">
        {products.length === 0 ? (
          <p className="text-sm text-text-muted">Sem vendas no período</p>
        ) : (
          products.slice(0, 5).map((product, i) => (
            <div key={product.label}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-text-secondary">
                  {i + 1}. {product.label}
                </span>
                <span className="font-medium text-text-primary">{product.value}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className="h-full rounded-full bg-brand-orange transition-all duration-500"
                  style={{ width: `${(product.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
