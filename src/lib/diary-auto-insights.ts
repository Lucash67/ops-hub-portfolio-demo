import { format, getDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { listDiaryEntries } from "@/lib/diary-service";
import { deriveDiaryTotalProfit } from "@/lib/diary/types";
import {
  fetchMetricClients,
  fetchMetricProducts,
  fetchMetricSaleItems,
  fetchMetricSales,
} from "@/platform/db/data-access/metrics";
import { flavorQuantityBreakdown, sumProfit } from "@/lib/analytics-engine/client";
import { isOperationalDay, WEEKDAY_SHORT } from "@/lib/operational-calendar";
import { previousOperationalDate } from "@/lib/temporal-filter";
import { canonicalSalgadosFlavor } from "@/lib/salgados-flavors";
import { formatCurrency } from "@/lib/utils";

export type DiaryAutoInsightCategory =
  | "mix"
  | "rhythm"
  | "client"
  | "compare"
  | "stock"
  | "finance";

export interface DiaryAutoInsight {
  id: string;
  category: DiaryAutoInsightCategory;
  type: "positive" | "warning" | "info" | "opportunity";
  title: string;
  description: string;
  metric?: string;
}

const MAX_INSIGHTS = 6;

/** @deprecated Use canonicalSalgadosFlavor — mantido para compatibilidade. */
export const canonicalFlavor = canonicalSalgadosFlavor;

function canonicalFlavorMap(breakdown: Record<string, number>): Map<string, number> {
  const map = new Map<string, number>();
  for (const [name, qty] of Object.entries(breakdown)) {
    const flavor = canonicalFlavor(name);
    if (!flavor) continue;
    map.set(flavor, (map.get(flavor) ?? 0) + qty);
  }
  return map;
}

function parseHour(time?: string): number | null {
  if (!time) return null;
  const match = time.match(/^(\d{1,2})/);
  return match ? Number(match[1]) : null;
}

function isUnknownClient(name: string | undefined | null): boolean {
  if (!name) return true;
  const n = name.toLowerCase();
  return n === "henrique" || n.includes("sem cliente") || n === "cliente";
}

function pushLimited(list: DiaryAutoInsight[], item: DiaryAutoInsight): void {
  if (list.length < MAX_INSIGHTS) list.push(item);
}

export async function generateDiaryAutoInsights(
  businessId: string,
  date: string,
): Promise<DiaryAutoInsight[]> {
  const insights: DiaryAutoInsight[] = [];
  const diaryEntries = await listDiaryEntries(businessId);
  const entry = diaryEntries.find((e) => e.date === date);
  const allDates = Array.from(
    new Set([
      ...diaryEntries.map((e) => e.date),
      ...(await fetchMetricSales({ businessId })).map((s) => s.date),
    ]),
  );

  const sales = (await fetchMetricSales({ businessId, dateEq: date }));
  const saleIds = sales.map((s) => s.id).filter(Boolean) as string[];
  const [items, products, clients] = await Promise.all([
    saleIds.length > 0 ? fetchMetricSaleItems(saleIds) : Promise.resolve([]),
    fetchMetricProducts(businessId),
    fetchMetricClients(),
  ]);

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "";
  const clientName = (id: string | null | undefined) =>
    clients.find((c) => c.id === id)?.name ?? null;

  if (!entry && sales.length === 0) {
    return [
      {
        id: "no-data",
        category: "finance",
        type: "info",
        title: "Sem dados para analisar",
        description: "Registre vendas ou o diário deste dia para gerar insights automáticos.",
      },
    ];
  }

  const flavorBreakdown = canonicalFlavorMap(
    flavorQuantityBreakdown(items, productName),
  );
  const totalUnits = Array.from(flavorBreakdown.values()).reduce((s, q) => s + q, 0);
  const revenue = entry?.revenue.received ?? sales.reduce((s, x) => s + x.totalAmount, 0);
  const profit = entry ? deriveDiaryTotalProfit(entry) : sumProfit(sales);
  const unitsSold = entry?.quantitySold ?? totalUnits;

  // —— Comparativo com dia operacional anterior ——
  const prevDate = previousOperationalDate(date, businessId, allDates);
  if (prevDate) {
    const prevSales = await fetchMetricSales({ businessId, dateEq: prevDate });
    const prevEntry = diaryEntries.find((e) => e.date === prevDate);
    const prevRevenue =
      prevEntry?.revenue.received ?? prevSales.reduce((s, x) => s + x.totalAmount, 0);
    const prevProfit = prevEntry
      ? deriveDiaryTotalProfit(prevEntry)
      : sumProfit(prevSales);
    const prevIds = prevSales.map((s) => s.id).filter(Boolean) as string[];
    const prevItems = prevIds.length ? await fetchMetricSaleItems(prevIds) : [];
    const prevUnits =
      prevEntry?.quantitySold ??
      Array.from(
        canonicalFlavorMap(flavorQuantityBreakdown(prevItems, productName)).values(),
      ).reduce((s, q) => s + q, 0);

    const revPct =
      prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : 0;
    const profitPct =
      prevProfit > 0 ? Math.round(((profit - prevProfit) / prevProfit) * 100) : 0;

    pushLimited(insights, {
      id: "vs-prev-day",
      category: "compare",
      type: profit >= prevProfit ? "positive" : "warning",
      title: `Comparado a ${format(parseISO(prevDate), "dd/MM", { locale: ptBR })}`,
      description: `Receita ${formatCurrency(revenue)} (${revPct >= 0 ? "+" : ""}${revPct}%) · lucro ${formatCurrency(profit)} (${profitPct >= 0 ? "+" : ""}${profitPct}%) · ${unitsSold} un. vs ${prevUnits} un. no dia anterior.`,
      metric: `${profitPct >= 0 ? "+" : ""}${profitPct}% lucro`,
    });
  }

  // —— Clientes: maiores compradores e fidelização ——
  const byClient = new Map<string, { name: string; total: number; count: number }>();
  for (const sale of sales) {
    const name = clientName(sale.clientId);
    if (isUnknownClient(name)) continue;
    const key = sale.clientId ?? name!;
    const row = byClient.get(key) ?? { name: name!, total: 0, count: 0 };
    row.total += sale.totalAmount;
    row.count += 1;
    byClient.set(key, row);
  }

  const rankedClients = Array.from(byClient.values()).sort(
    (a, b) => b.total - a.total || b.count - a.count,
  );

  if (rankedClients[0]) {
    const top = rankedClients[0];
    const first = top.name.split(" ")[0];
    pushLimited(insights, {
      id: "top-buyer",
      category: "client",
      type: "positive",
      title: `${first} foi o maior comprador`,
      description:
        top.count >= 2
          ? `${top.count} compras · ${formatCurrency(top.total)} no dia — recorrência intradiária, bom sinal de fidelização.`
          : `${formatCurrency(top.total)} em 1 compra — acompanhe para converter em cliente recorrente.`,
      metric: formatCurrency(top.total),
    });
  }

  const loyalToday = rankedClients.filter((c) => c.count >= 2);
  if (loyalToday.length > 0 && insights.every((i) => i.id !== "top-buyer" || loyalToday.length > 1)) {
    const names = loyalToday
      .slice(0, 3)
      .map((c) => c.name.split(" ")[0])
      .join(", ");
    pushLimited(insights, {
      id: "repeat-buyers",
      category: "client",
      type: "positive",
      title: `${loyalToday.length} cliente(s) comprou(aram) 2+ vezes`,
      description: `${names} — demanda aquecida; vale reforçar relacionamento e oferta fixa.`,
    });
  }

  // —— Mix: líder e menor saída ——
  if (flavorBreakdown.size >= 1) {
    const ranked = Array.from(flavorBreakdown.entries()).sort((a, b) => b[1] - a[1]);
    const [topFlavor, topQty] = ranked[0]!;

    pushLimited(insights, {
      id: "mix-top",
      category: "mix",
      type: "info",
      title: `${topFlavor} saiu mais`,
      description: `${topQty} un. (${Math.round((topQty / totalUnits) * 100)}% das vendas identificadas).`,
      metric: `${topQty} un.`,
    });

    if (ranked.length >= 2) {
      const [lowFlavor, lowQty] = ranked[ranked.length - 1]!;
      if (lowFlavor !== topFlavor) {
        pushLimited(insights, {
          id: "mix-low",
          category: "mix",
          type: "opportunity",
          title: `${lowFlavor} saiu menos`,
          description: `Apenas ${lowQty} un. no dia — menor saída entre os sabores vendidos.`,
          metric: `${lowQty} un.`,
        });
      }
    }
  }

  // —— Esgotamento / giro mais rápido (compra do diário vs vendas) ——
  if (entry?.purchase?.products.length && flavorBreakdown.size > 0) {
    const purchased = new Map<string, number>();
    for (const p of entry.purchase.products) {
      const f = canonicalFlavor(p.name);
      if (!f) continue;
      purchased.set(f, (purchased.get(f) ?? 0) + p.quantity);
    }

    let bestSellThrough: { flavor: string; rate: number; sold: number; bought: number } | null =
      null;
    for (const [flavor, bought] of Array.from(purchased.entries())) {
      if (bought <= 0) continue;
      const sold = flavorBreakdown.get(flavor) ?? 0;
      const rate = sold / bought;
      if (
        sold > 0 &&
        (!bestSellThrough || rate > bestSellThrough.rate)
      ) {
        bestSellThrough = { flavor, rate, sold, bought };
      }
    }

    if (bestSellThrough && bestSellThrough.rate >= 0.8) {
      const { flavor, sold, bought, rate } = bestSellThrough;
      pushLimited(insights, {
        id: "fastest-sellout",
        category: "stock",
        type: rate >= 1 ? "warning" : "positive",
        title:
          sold >= bought
            ? `${flavor} esgotou no dia`
            : `${flavor} girou mais rápido`,
        description: `Levou ${bought} · vendeu ${sold} (${Math.round(rate * 100)}% do estoque do sabor).${
          sold >= bought ? " Considere aumentar a quantidade amanhã." : ""
        }`,
        metric: `${Math.round(rate * 100)}%`,
      });
    }
  }

  // —— Sabor novo (nunca vendido antes nesta operação) ——
  if (flavorBreakdown.size > 0) {
    const histSales = (await fetchMetricSales({ businessId, dateLte: date })).filter(
      (s) => s.date < date,
    );
    const histIds = histSales.map((s) => s.id).filter(Boolean) as string[];
    const histItems = histIds.length ? await fetchMetricSaleItems(histIds) : [];
    const histFlavors = new Set<string>();
    for (const [name] of Object.entries(flavorQuantityBreakdown(histItems, productName))) {
      const f = canonicalFlavor(name);
      if (f) histFlavors.add(f);
    }

    const todayFlavors = Array.from(flavorBreakdown.keys());
    const novel = todayFlavors.filter((f) => !histFlavors.has(f));
    if (novel.length > 0 && histFlavors.size > 0) {
      pushLimited(insights, {
        id: "new-flavor",
        category: "mix",
        type: "info",
        title: `Sabor novo no histórico: ${novel.join(", ")}`,
        description: "Primeira vez que este sabor aparece nas vendas registradas — monitore aceitação nos próximos dias.",
      });
    }
  }

  // —— Ritmo: manhã vs tarde (só se relevante) ——
  if (sales.length >= 4) {
    const morning = sales.filter((s) => {
      const h = parseHour(s.time);
      return h !== null && h < 12;
    }).length;
    const morningPct = Math.round((morning / sales.length) * 100);
    if (morningPct >= 65 || morningPct <= 35) {
      pushLimited(insights, {
        id: "rhythm",
        category: "rhythm",
        type: morningPct >= 65 ? "positive" : "info",
        title: morningPct >= 65 ? "Maior movimento de manhã" : "Maior movimento à tarde",
        description: `${morningPct}% das vendas antes do meio-dia (${morning} de ${sales.length}).`,
        metric: `${morningPct}% AM`,
      });
    }
  }

  // —— Fiado / pendências ——
  const pending = sales.filter(
    (s) => s.paymentStatus === "pending" || s.paymentStatus === "partial",
  );
  if (pending.length > 0) {
    pushLimited(insights, {
      id: "pending-payments",
      category: "client",
      type: "warning",
      title: `${pending.length} pagamento(s) pendente(s)`,
      description: "Há fiado neste dia — acompanhe quitação para não confundir com perda.",
      metric: String(pending.length),
    });
  }

  // —— Perdas registradas ——
  if (entry && entry.quantityLost > 0) {
    pushLimited(insights, {
      id: "loss",
      category: "stock",
      type: "warning",
      title: `${entry.quantityLost} un. perdida(s)`,
      description: entry.lossReason ?? "Divergência entre estoque e pagamentos.",
    });
  }

  // —— Meta do dia ——
  if (entry?.dailyGoalUnits && entry.quantitySold >= entry.dailyGoalUnits) {
    pushLimited(insights, {
      id: "goal-hit",
      category: "finance",
      type: "positive",
      title: "Meta diária atingida",
      description: `${entry.quantitySold} de ${entry.dailyGoalUnits} un. vendidas.`,
      metric: "Meta ✓",
    });
  }

  // —— Média do mesmo dia da semana (só se diferente o suficiente) ——
  const weekday = getDay(parseISO(date));
  const sameWeekday = diaryEntries.filter(
    (e) =>
      e.date < date &&
      getDay(parseISO(e.date)) === weekday &&
      isOperationalDay(e.date, businessId),
  );
  if (sameWeekday.length >= 2 && entry && insights.length < MAX_INSIGHTS) {
    const avgProfit =
      sameWeekday.reduce((s, e) => s + deriveDiaryTotalProfit(e), 0) / sameWeekday.length;
    const diff = profit - avgProfit;
    if (Math.abs(diff) >= 8) {
      pushLimited(insights, {
        id: "vs-weekday-avg",
        category: "compare",
        type: diff > 0 ? "positive" : "info",
        title: `${WEEKDAY_SHORT[weekday]} ${diff > 0 ? "acima" : "abaixo"} da sua média`,
        description: `Média de ${sameWeekday.length} ${WEEKDAY_SHORT[weekday]}s anteriores: ${formatCurrency(avgProfit)} · hoje: ${formatCurrency(profit)}.`,
      });
    }
  }

  return dedupeInsights(insights).slice(0, MAX_INSIGHTS);
}

export async function generateRecentDiaryInsights(
  businessId: string,
  limit = 5,
): Promise<DiaryAutoInsight[]> {
  const entries = (await listDiaryEntries(businessId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);

  const all: DiaryAutoInsight[] = [];
  for (const entry of entries) {
    const dayInsights = await generateDiaryAutoInsights(businessId, entry.date);
    for (const ins of dayInsights.slice(0, 2)) {
      all.push({
        ...ins,
        id: `${entry.date}-${ins.id}`,
        title: `${format(parseISO(entry.date), "dd/MM")}: ${ins.title}`,
      });
    }
  }
  return dedupeInsights(all).slice(0, 10);
}

function dedupeInsights(list: DiaryAutoInsight[]): DiaryAutoInsight[] {
  const seen = new Set<string>();
  return list.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
}
