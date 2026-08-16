import { format } from "date-fns";
import { SALGADOS_BUSINESS_ID } from "@/lib/business-units";
import { formatSaleShift, normalizeSaleShiftTime } from "@/lib/sale-shift";
import { UNIDENTIFIED_FLAVOR_PRODUCT_NAME } from "@/lib/salgados-flavors";
import type { DayRegistrationPlan, DraftSale } from "./types";

const DEPT_FLOOR = "Praça de Alimentação";
const DEPT_PARTNER = "Clientes do parceiro";
const UNKNOWN_PRODUCT = UNIDENTIFIED_FLAVOR_PRODUCT_NAME;

type LucasSection =
  | "encomendados"
  | "pai"
  | "acal"
  | "vendas"
  | "devendo"
  | "observacoes"
  | "previsao"
  | "faturamento"
  | null;

export interface ParseDraftResult {
  plan: DayRegistrationPlan | null;
  errors: string[];
  warnings: string[];
}

function parseMoney(raw: string): number {
  let v = raw.trim().replace(/^[-•*⁠\u200B]+\s*/, "");

  const rsMatch = v.match(/R\$\s*([\d:,.]+)/i);
  if (rsMatch) {
    v = rsMatch[1];
  } else {
    const afterColon = v.split(":").pop()?.trim() ?? v;
    v = afterColon.replace(/R\$\s*/gi, "").trim();
  }

  if (/^\d+:\d{2}$/.test(v)) v = v.replace(":", ",");

  if (v.includes(",") && v.includes(".")) {
    v = v.replace(/\./g, "").replace(",", ".");
  } else if (v.includes(",")) {
    v = v.replace(",", ".");
  }

  const n = Number(v.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normalizeProductName(raw: string): string {
  const n = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!n || n === "1" || n.includes("nao vi") || n.includes("nao identificado")) {
    return UNKNOWN_PRODUCT;
  }
  if (n.includes("croissant") || n.includes("croisant") || n.includes("crosisant")) return "Croissant";
  // Carne com cheddar (forno vs frito) antes dos pastéis genéricos.
  if (n.includes("cheddar") && n.includes("forno")) return "Carne com Cheddar de Forno";
  if (n.includes("cheddar") || (n.includes("carne") && n.includes("frito") && !n.includes("pastel"))) {
    return "Carne Frito";
  }
  // Pastel de carne antes do mistão frito (pastel / pastel mistão).
  if (n.includes("pastel") && n.includes("carne")) return "Pastel de Carne";
  if (n.includes("pastel")) return "Mistão Frito";
  // Mistão de forno (ex-Misto com Catupiry) — "mistao forno" / misto sem pastel.
  if (n.includes("mist") && n.includes("forno")) return "Mistão de Forno";
  if (n.includes("mist")) return "Mistão de Forno";
  // Legado: frango + catupiry sem mistão.
  if (
    (n.includes("frango") || n.includes("catupiry") || n.includes("cautpiry")) &&
    !n.includes("mist") &&
    (n.includes("catupiry") || n.includes("cautpiry") || n.includes("forno"))
  ) {
    return "Mistão de Forno";
  }
  return raw.trim();
}

function parseProductLine(line: string): { name: string; quantity: number } | null {
  const cleaned = line
    .replace(/^[-•*⁠\u200B]+\s*/, "")
    .replace(/\s*✅.*/i, "")
    .trim();
  const match = cleaned.match(/^(\d+)\s+(.+)$/i);
  if (!match) return null;
  return {
    quantity: Number(match[1]),
    name: normalizeProductName(match[2]),
  };
}

function extractTimes(text: string): { primary?: string; pickup?: string; paid?: string } {
  // Turno explícito tem prioridade sobre HH:mm legado.
  const pipeShift = text.match(/\|\s*(manh[ãa]|tarde)\b/i);
  const standaloneShift = text.match(/(?:^|\s)(manh[ãa]|tarde)(?:\s|$)/i);
  const pipeTime = text.match(/\|\s*(\d{2}:\d{2})/);
  const pickup = text.match(/pegou as (\d{2}:\d{2})/i);
  const paid = text.match(/pagou as (\d{2}:\d{2})/i);
  const standalone = text.match(/(?:^|\s)(\d{2}:\d{2})(?:\s|$)/);

  return {
    primary:
      pipeShift?.[1] ??
      standaloneShift?.[1] ??
      pipeTime?.[1] ??
      paid?.[1] ??
      pickup?.[1] ??
      standalone?.[1],
    pickup: pickup?.[1],
    paid: paid?.[1],
  };
}

function parsePaymentMethod(text: string): "pix" | "card" | "cash" {
  const n = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  // Pix primeiro — evita falso positivo de "card" dentro de nomes (ex.: Ricardo).
  if (n.includes("pix")) return "pix";
  if (n.includes("moeda") || n.includes("especie") || n.includes("dinheiro")) {
    return "cash";
  }
  if (n.includes("cartao") || /\bcard\b/.test(n)) return "card";
  return "pix";
}

function parsePaymentStatus(text: string): "paid" | "pending" | "partial" {
  const n = text.toLowerCase();
  if (n.includes("⚠") || n.includes("devendo") || n.includes("não pagou") || n.includes("nao pagou")) {
    return "pending";
  }
  return "paid";
}

function splitProductParts(productText: string): Array<{ quantity: number; name: string }> {
  const cleaned = productText.trim();
  if (!cleaned || cleaned === "1" || /\(n[aã]o vi\)/i.test(cleaned)) {
    return [{ quantity: 1, name: UNKNOWN_PRODUCT }];
  }

  const parts = cleaned.split(/\s+e\s+/i);
  const results: Array<{ quantity: number; name: string }> = [];

  for (const part of parts) {
    const match = part.trim().match(/^(\d+)\s*(.*)$/);
    if (match) {
      const qty = Number(match[1]);
      const nameRaw = match[2].trim();
      results.push({
        quantity: qty,
        name: nameRaw ? normalizeProductName(nameRaw) : UNKNOWN_PRODUCT,
      });
    }
  }

  return results.length > 0 ? results : [{ quantity: 1, name: normalizeProductName(cleaned) }];
}

function parseLucasSaleLine(line: string, date: string): DraftSale[] | null {
  const numbered = line.match(/^\d+\s*-\s*(.+)$/);
  if (!numbered) return null;

  const body = numbered[1].trim();

  if (
    /^n[aã]o pagou/i.test(body) ||
    /^roubado/i.test(body) ||
    /salgado sumiu/i.test(body)
  ) {
    return [
      {
        time: normalizeSaleShiftTime("manhã"),
        clientName: `Cliente Não Identificado (${date})`,
        productName: UNKNOWN_PRODUCT,
        quantity: 1,
        paymentMethod: "pix",
        paymentStatus: "pending",
        department: DEPT_FLOOR,
        notes: body,
      },
    ];
  }

  let clientName = "";
  let productPart = "";
  let metaPart = "";

  const colonSplit = body.match(/^(.+?):\s*(.+)$/);
  if (colonSplit) {
    clientName = colonSplit[1].trim();
    const afterColon = colonSplit[2];
    const pipeIdx = afterColon.indexOf("|");
    if (pipeIdx >= 0) {
      productPart = afterColon.slice(0, pipeIdx).trim();
      metaPart = afterColon.slice(pipeIdx + 1).trim();
    } else {
      productPart = afterColon.trim();
    }
  } else {
    const inline = body.match(/^(.+?)\s+(\d+\s*.+)$/);
    if (inline) {
      clientName = inline[1].trim();
      productPart = inline[2].trim();
      metaPart = body.includes("|") ? body.split("|").slice(1).join("|").trim() : "";
    }
  }

  if (!clientName) return null;

  if (/n[aã]o identificado/i.test(clientName) && !clientName.includes("(")) {
    clientName = `${clientName} (${date})`;
  }

  const times = extractTimes(`${productPart} | ${metaPart} ${body}`);
  const time = normalizeSaleShiftTime(times.primary ?? "manhã");

  const notes: string[] = [];
  if (times.pickup && times.paid && times.pickup !== times.paid) {
    notes.push(
      `Pegou de ${formatSaleShift(times.pickup)}, pagou de ${formatSaleShift(times.paid)}`,
    );
  }
  if (
    metaPart &&
    !/^\d{2}:\d{2}$/.test(metaPart) &&
    !/^(manh[ãa]|tarde)$/i.test(metaPart.trim())
  ) {
    notes.push(metaPart.replace(/✅.*$/i, "").trim());
  }

  const paymentMethod = parsePaymentMethod(`${body} ${metaPart}`);
  const paymentStatus = parsePaymentStatus(body);
  const products = splitProductParts(productPart || "1");

  return products.map((p) => ({
    time,
    clientName,
    productName: p.name,
    quantity: p.quantity,
    paymentMethod,
    paymentStatus,
    department: DEPT_FLOOR,
    notes: notes.filter(Boolean).join(" · ") || undefined,
  }));
}

function detectSection(line: string): LucasSection | "skip" | "date" {
  const n = line.toLowerCase().trim();

  if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(n)) return "date";
  if (n.startsWith("encomendados hoje")) return "encomendados";
  if (n.startsWith("separados para o trabalho")) return "pai";
  // Aceita "Separados para acal" e "Separados para a acal".
  if (n.startsWith("separados para") && n.includes("acal")) return "acal";
  if (n.startsWith("histórico de vendas") || n.startsWith("historico de vendas")) return "vendas";
  if (n.startsWith("devendo ainda")) return "devendo";
  if (n.startsWith("observações do dia") || n.startsWith("observacoes do dia")) return "observacoes";
  if (n.startsWith("previsões de lucro") || n.startsWith("previsoes de lucro")) return "previsao";
  if (
    n.startsWith("faturamento") ||
    n.startsWith("lucro total do dia") ||
    n.startsWith("lucro real do dia")
  ) {
    return "faturamento";
  }
  if (n.startsWith("obs:") || n.startsWith("*hoje")) return "skip";

  return null;
}

function parseDateLine(line: string, defaultYear: number): string | null {
  const match = line.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  let year = defaultYear;
  if (match[3]) {
    year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  }
  return `${year}-${month}-${day}`;
}

function isLegacyAtSection(raw: string): boolean {
  return raw.trim().startsWith("@");
}

function parseLegacyDraft(raw: string): ParseDraftResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let date = format(new Date(), "yyyy-MM-dd");
  let businessId = SALGADOS_BUSINESS_ID;
  const sales: DraftSale[] = [];
  const purchaseProducts: Array<{ name: string; quantity: number }> = [];
  let purchaseInvestment = 0;
  let purchaseOwn: number | undefined;
  const summary = { revenue: 0, profit: 0, quantitySold: 0, quantityLost: 0 };
  let section: string | null = null;
  const observations: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("@DATA ")) {
      date = t.slice(6).trim().slice(0, 10);
      continue;
    }
    if (t.startsWith("@OPERACAO ")) {
      businessId = t.slice(10).trim().toLowerCase();
      continue;
    }
    if (t.startsWith("@")) {
      section = t.slice(1).split(/\s/)[0].toUpperCase();
      continue;
    }
    if (section === "COMPRA") {
      const prod = parseProductLine(t);
      if (prod) purchaseProducts.push(prod);
      const kv = t.match(/^([^:]+):\s*(.+)$/);
      if (kv?.[1].toLowerCase().includes("investimento")) purchaseInvestment = parseMoney(kv[2]);
      if (kv?.[1].toLowerCase().includes("proprio")) purchaseOwn = parseMoney(kv[2]);
    }
    if (section === "RESUMO") {
      const kv = t.match(/^([^:]+):\s*(.+)$/);
      if (kv?.[1].toLowerCase().includes("receita")) summary.revenue = parseMoney(kv[2]);
      if (kv?.[1].toLowerCase().includes("lucro")) summary.profit = parseMoney(kv[2]);
      if (kv?.[1].toLowerCase().includes("vendidas")) summary.quantitySold = Number(kv[2]) || 0;
    }
    if (section === "VENDAS") {
      const parts = t.split("|").map((p) => p.trim());
      if (parts.length >= 5) {
        sales.push({
          time: normalizeSaleShiftTime(parts[0]),
          clientName: parts[1],
          productName: normalizeProductName(parts[2].replace(/\s+x\s*\d+$/i, "")),
          quantity: 1,
          paymentMethod: parsePaymentMethod(parts[3]),
          paymentStatus: "paid",
          department: parts[4],
        });
      }
    }
    if (section === "OBSERVACOES" || section === "OBSERVAÇÕES") observations.push(line);
  }

  if (sales.length === 0) errors.push("Nenhuma venda encontrada no formato @VENDAS.");
  if (errors.length) return { plan: null, errors, warnings };

  return {
    plan: {
      businessId,
      date,
      purchase:
        purchaseProducts.length > 0
          ? {
              totalUnits: purchaseProducts.reduce((s, p) => s + p.quantity, 0),
              investment: purchaseInvestment,
              ownInvestment: purchaseOwn,
              products: purchaseProducts,
            }
          : undefined,
      summary,
      sales,
      newClients: sales.map((s) => ({ name: s.clientName, sector: s.department })),
      observations: observations.join("\n").trim() || undefined,
    },
    errors,
    warnings,
  };
}

export function parseDayDraft(raw: string): ParseDraftResult {
  if (isLegacyAtSection(raw)) {
    return parseLegacyDraft(raw);
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const defaultYear = new Date().getFullYear();

  let date = format(new Date(), "yyyy-MM-dd");
  const businessId = SALGADOS_BUSINESS_ID;
  let section: LucasSection = null;

  const purchaseProducts: Array<{ name: string; quantity: number }> = [];
  const acalAllocation: Array<{ name: string; quantity: number }> = [];
  const fatherAllocation: Array<{ name: string; quantity: number }> = [];
  let purchaseInvestment = 0;
  let purchaseOwn: number | undefined;
  let purchaseThirdParty: { name: string; amount: number } | undefined;
  let forecastProfit: number | undefined;

  const summary = {
    revenue: 0,
    profit: 0,
    quantitySold: 0,
    quantityLost: 0,
    forecastProfit: undefined as number | undefined,
  };

  const sales: DraftSale[] = [];
  const observationLines: string[] = [];
  const debtLines: string[] = [];

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^-+$/.test(line)) continue;

    const detected = detectSection(line);

    if (detected === "date") {
      const parsed = parseDateLine(line, defaultYear);
      if (parsed) date = parsed;
      section = null;
      continue;
    }

    if (detected === "skip") {
      observationLines.push(rawLine);
      continue;
    }

    if (detected) {
      section = detected;
      continue;
    }

    if (/^custo total dos salgados:/i.test(line)) {
      purchaseInvestment = parseMoney(line.split(":").slice(1).join(":"));
      continue;
    }
    if (/^minha parte investida:/i.test(line)) {
      purchaseOwn = parseMoney(line.split(":").slice(1).join(":"));
      continue;
    }
    if (/^parte restante do meu pai/i.test(line)) {
      const amountMatch = line.match(/R?\$?\s*([\d:,.]+)/i);
      const amount = amountMatch ? parseMoney(amountMatch[0]) : 0;
      if (amount > 0) {
        purchaseThirdParty = {
          name: "parceiro",
          amount,
        };
      }
      continue;
    }

    if (section === "encomendados") {
      const p = parseProductLine(line);
      if (p && p.quantity > 0) purchaseProducts.push(p);
      continue;
    }

    if (section === "pai") {
      const p = parseProductLine(line);
      if (p && p.quantity > 0) fatherAllocation.push(p);
      continue;
    }

    if (section === "acal") {
      const p = parseProductLine(line);
      if (p && p.quantity > 0) acalAllocation.push(p);
      continue;
    }

    if (section === "vendas") {
      const parsedSales = parseLucasSaleLine(line, date);
      if (parsedSales) {
        sales.push(...parsedSales);
      } else if (/^\d+\s*-/.test(line)) {
        warnings.push(`Venda não interpretada: "${line}"`);
      }
      continue;
    }

    if (section === "devendo") {
      debtLines.push(line);
      continue;
    }

    if (section === "observacoes") {
      observationLines.push(rawLine);
      continue;
    }

    if (section === "previsao") {
      if (/lucro/i.test(line)) forecastProfit = parseMoney(line);
      continue;
    }

    if (section === "faturamento") {
      const lower = line.toLowerCase();
      if (lower.includes("faturamento")) summary.revenue = parseMoney(line);
      if (lower.includes("lucro")) summary.profit = parseMoney(line);
      if (lower.includes("investimento") && lower.includes("meu")) {
        purchaseOwn = parseMoney(line);
      }
      continue;
    }

    if (/^lucro total do dia:/i.test(line) || /^- lucro total do dia:/i.test(line)) {
      summary.profit = parseMoney(line);
    }
  }

  if (sales.length === 0) {
    errors.push(
      'Nenhuma venda encontrada. Use "Histórico de vendas:" com linhas como: 1 - Nome: 1 Croissant | 09:00 ✅Pix',
    );
  }

  const saleUnits = sales.reduce((sum, s) => sum + s.quantity, 0);
  if (summary.quantitySold === 0) summary.quantitySold = saleUnits;

  if (summary.revenue === 0 && saleUnits > 0) {
    summary.revenue = saleUnits * 5;
    warnings.push("Faturamento não informado — estimativa provisória de R$5/unidade no preview.");
  }

  if (summary.profit === 0 && purchaseOwn !== undefined && summary.revenue > 0) {
    summary.profit = summary.revenue - purchaseOwn;
    warnings.push("Lucro calculado provisoriamente: faturamento − sua parte investida.");
  }

  if (forecastProfit !== undefined) {
    summary.forecastProfit = forecastProfit;
    warnings.push(
      `Lucro previsto (R$${forecastProfit.toFixed(2)}) é só referência — não entra no registro automático.`,
    );
  }

  const totalUnits =
    purchaseProducts.reduce((s, p) => s + p.quantity, 0) ||
    acalAllocation.reduce((s, p) => s + p.quantity, 0) +
      fatherAllocation.reduce((s, p) => s + p.quantity, 0);

  const purchase =
    purchaseProducts.length > 0 || purchaseInvestment > 0
      ? {
          totalUnits: totalUnits || saleUnits,
          investment: purchaseInvestment,
          ownInvestment: purchaseOwn,
          thirdParty: purchaseThirdParty,
          products: purchaseProducts,
          acalAllocation: acalAllocation.length > 0 ? acalAllocation : undefined,
          fatherAllocation: fatherAllocation.length > 0 ? fatherAllocation : undefined,
        }
      : undefined;

  const clientNames = new Set<string>();
  for (const sale of sales) {
    clientNames.add(sale.clientName);
  }

  const newClients = Array.from(clientNames).map((name) => ({
    name,
    sector:
      name.toLowerCase().includes("parceiro") || name.toLowerCase().includes("pai")
        ? DEPT_PARTNER
        : DEPT_FLOOR,
  }));

  const pendingSales = sales.filter((s) => s.paymentStatus === "pending");
  if (pendingSales.length > 0) {
    warnings.push(`${pendingSales.length} venda(s) marcada(s) como pendente/devendo.`);
  }

  if (debtLines.length > 0) {
    observationLines.unshift("Cobranças / dívidas anteriores:", ...debtLines);
    warnings.push("Linhas 'Devendo ainda de ontem' foram para observações — revise pagamentos retroativos.");
  }

  if (fatherAllocation.length > 0) {
    warnings.push(
      "Vendas do trabalho do pai ficam fora do histórico ACAL — registre quando tiver horário, cliente e pagamento.",
    );
  }

  if (errors.length > 0) {
    return { plan: null, errors, warnings };
  }

  const plan: DayRegistrationPlan = {
    businessId,
    date,
    purchase,
    summary,
    sales,
    newClients,
    observations: observationLines.join("\n").trim() || undefined,
  };

  return { plan, errors, warnings };
}
