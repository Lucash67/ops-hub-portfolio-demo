import { upsertDiaryEntry } from "@/lib/diary-service";
import type { OperationalDiaryEntry } from "@/lib/diary/types";
import { executeSaleOperation } from "@/domains/sales/sale-operation-handler";
import { createClient, listClientsRaw } from "@/platform/db/repositories/client-repository";
import {
  createProduct,
  getProductById,
  listProducts,
  updateProduct,
} from "@/platform/db/repositories/product-repository";
import { countSalesForDate } from "@/platform/db/repositories/sale-repository";
import {
  recordStockMovement,
  updateStockQuantity,
} from "@/platform/db/repositories/stock-repository";
import { ensureOperationDayId } from "@/platform/db/repositories/operation-day-repository";
import { getPostgresDb, isPostgres } from "@/platform/db";
import { queryRun } from "@/platform/db/query";
import { dailyInvestments } from "@/lib/db/postgres/schema";
import { generateId } from "@/shared/ids/generate-id";
import { parseDayDraft } from "./draft-parser";
import type {
  ClientMatchPreview,
  DayRegistrationPlan,
  DayRegistrationPreview,
  ProductMatchPreview,
} from "./types";
import { dayRegistrationPlanSchema } from "./types";
import {
  buildPricingPreviewWarnings,
  resolveDayRegistrationPricing,
} from "./pricing";
import { UNIDENTIFIED_FLAVOR_PRODUCT_NAME } from "@/lib/salgados-flavors";

const UNKNOWN_PRODUCT_NAME = UNIDENTIFIED_FLAVOR_PRODUCT_NAME;

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function resolveProductByName(
  name: string,
  products: Awaited<ReturnType<typeof listProducts>>,
): { id: string; name: string } | null {
  const target = normalizeName(name);
  // Somente match exato — match parcial misturava "Pastel de Carne" com
  // "Pastel de Frango…" e "Carne Frito" com "Carne com Cheddar de Forno".
  const exact = products.find((p) => normalizeName(p.name) === target);
  if (exact) return { id: exact.id, name: exact.name };
  return null;
}

async function countSalesForDay(businessId: string, date: string): Promise<number> {
  return countSalesForDate(businessId, date);
}

async function buildProductMatches(
  plan: DayRegistrationPlan,
  products: Awaited<ReturnType<typeof listProducts>>,
): Promise<ProductMatchPreview[]> {
  const matches: ProductMatchPreview[] = [];
  const seen = new Set<string>();

  for (const productLine of plan.purchase?.products ?? []) {
    const key = `purchase:${productLine.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const match = resolveProductByName(productLine.name, products);
    matches.push({
      context: "Compra",
      productName: productLine.name,
      matchedProductId: match?.id,
      matchedProductName: match?.name,
      willCreate: !match,
    });
  }

  for (const sale of plan.sales) {
    const key = `sale:${sale.productName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const match = resolveProductByName(sale.productName, products);
    matches.push({
      context: "Venda",
      productName: sale.productName,
      matchedProductId: match?.id,
      matchedProductName: match?.name,
      willCreate: !match && normalizeName(sale.productName) !== normalizeName(UNKNOWN_PRODUCT_NAME),
    });
  }

  return matches;
}

async function buildClientMatches(
  plan: DayRegistrationPlan,
  existingClients: Awaited<ReturnType<typeof listClientsRaw>>,
): Promise<ClientMatchPreview[]> {
  const byName = new Map(existingClients.map((c) => [normalizeName(c.name), c]));
  const names = new Set<string>();

  for (const client of plan.newClients) {
    names.add(normalizeName(client.name));
  }
  for (const sale of plan.sales) {
    names.add(normalizeName(sale.clientName));
  }

  const matches: ClientMatchPreview[] = [];
  for (const name of Array.from(names)) {
    const displayName =
      plan.newClients.find((c) => normalizeName(c.name) === name)?.name ??
      plan.sales.find((s) => normalizeName(s.clientName) === name)?.clientName ??
      name;

    const existing = byName.get(name);
    const willCreate = !existing;

    matches.push({
      clientName: displayName,
      existingClientId: existing?.id,
      existingClientName: existing?.name,
      willCreate,
    });
  }

  return matches;
}

export async function previewDayRegistration(draft: string): Promise<DayRegistrationPreview> {
  const { plan, errors, warnings } = parseDayDraft(draft);
  if (!plan) {
    return {
      businessId: "",
      date: "",
      summary: { revenue: 0, profit: 0, quantitySold: 0, quantityLost: 0 },
      sales: [],
      newClients: [],
      warnings,
      errors,
      productMatches: [],
      clientMatches: [],
      dayAlreadyRegistered: false,
      existingSalesCount: 0,
    };
  }

  const [products, existingClients, existingSalesCount] = await Promise.all([
    listProducts(plan.businessId),
    listClientsRaw(),
    countSalesForDay(plan.businessId, plan.date),
  ]);
  const productMatches = await buildProductMatches(plan, products);
  const clientMatches = await buildClientMatches(plan, existingClients);

  for (const match of productMatches) {
    if (match.willCreate) {
      warnings.push(`Produto "${match.productName}" será criado automaticamente.`);
    }
  }

  if (plan.summary.quantitySold > 0 && plan.summary.revenue > 0) {
    const pricing = resolveDayRegistrationPricing(plan);
    warnings.push(...buildPricingPreviewWarnings(pricing));
  }


  const saleUnits = plan.sales.reduce((sum, sale) => sum + sale.quantity, 0);
  if (plan.summary.quantitySold > 0 && saleUnits !== plan.summary.quantitySold) {
    warnings.push(
      `Unidades vendidas no @RESUMO (${plan.summary.quantitySold}) difere da soma das vendas (${saleUnits}).`,
    );
  }

  return {
    ...plan,
    warnings,
    errors,
    productMatches,
    clientMatches,
    dayAlreadyRegistered: existingSalesCount > 0,
    existingSalesCount,
  };
}

async function resolveOrCreateProductId(
  productName: string,
  businessId: string,
  unitPrice: number,
  unitCost: number,
  cache: Map<string, string>,
): Promise<string> {
  const cacheKey = normalizeName(productName);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const products = await listProducts(businessId);
  const match = resolveProductByName(productName, products);
  if (match) {
    cache.set(cacheKey, match.id);
    return match.id;
  }

  const createdId = await createProduct({
    businessId,
    name: productName,
    category: "Salgados",
    price: unitPrice,
    cost: unitCost,
    stockQuantity: 0,
    minStock: 0,
    status: "active",
  });
  cache.set(cacheKey, createdId);
  return createdId;
}

async function registerInvestments(
  businessId: string,
  date: string,
  purchase: NonNullable<DayRegistrationPlan["purchase"]>,
): Promise<void> {
  if (!isPostgres()) return;
  if (purchase.investment <= 0) return;

  const operationDayId = await ensureOperationDayId(businessId, date);
  const db = await getPostgresDb();

  const ownAmount = purchase.ownInvestment ?? 0;
  const thirdAmount = purchase.thirdParty?.amount ?? 0;
  const hasSplit = ownAmount > 0 || thirdAmount > 0;

  if (hasSplit) {
    if (ownAmount > 0) {
      await queryRun(
        db.insert(dailyInvestments).values({
          id: generateId(),
          operationDayId,
          amount: String(ownAmount),
          investmentType: "additional",
          sourceType: "own_capital",
          sourceName: null,
          description: `Investimento próprio — compra diária ${date}.`,
        }),
      );
    }

    if (thirdAmount > 0) {
      await queryRun(
        db.insert(dailyInvestments).values({
          id: generateId(),
          operationDayId,
          amount: String(thirdAmount),
          investmentType: "additional",
          sourceType: "family",
          sourceName: purchase.thirdParty?.name ?? "Terceiro",
          description: `Investimento ${purchase.thirdParty?.name ?? "terceiro"} — compra diária ${date}.`,
        }),
      );
    }
    return;
  }

  await queryRun(
    db.insert(dailyInvestments).values({
      id: generateId(),
      operationDayId,
      amount: String(purchase.investment),
      investmentType: "additional",
      sourceType: "own_capital",
      sourceName: null,
      description: `Investimento — compra diária ${date}.`,
    }),
  );
}

async function syncProductCatalogPricing(
  productId: string,
  unitPrice: number,
  unitCostFull: number,
): Promise<void> {
  const product = await getProductById(productId);
  if (!product) return;
  if (product.price === unitPrice && product.cost === unitCostFull) return;

  await updateProduct({
    id: product.id,
    name: product.name,
    category: product.category,
    price: unitPrice,
    cost: unitCostFull,
    stockQuantity: product.stockQuantity,
    minStock: product.minStock,
    status: product.status,
  });
}

function buildDiaryEntry(plan: DayRegistrationPlan): OperationalDiaryEntry {
  const pricing = resolveDayRegistrationPricing(plan);
  const insightLines: string[] = [];
  if (pricing.profitExplanation) {
    insightLines.push(pricing.profitExplanation);
  }
  if (plan.manualInsights?.trim()) {
    insightLines.push(plan.manualInsights.trim());
  }

  const purchase = plan.purchase
    ? {
        totalUnits: plan.purchase.totalUnits,
        investment: plan.purchase.investment,
        products: plan.purchase.products,
      }
    : undefined;

  return {
    version: 1,
    businessId: plan.businessId,
    date: plan.date,
    dailyGoalUnits: plan.dailyGoalUnits,
    purchase,
    revenue: {
      received: plan.summary.revenue,
      pending: 0,
      total: plan.summary.revenue,
    },
    profit: plan.summary.profit,
    quantitySold: plan.summary.quantitySold,
    quantityLost: plan.summary.quantityLost,
    lossReason: plan.summary.lossReason,
    observations: plan.observations,
    manualInsights: insightLines.length > 0 ? insightLines.join("\n\n") : undefined,
    lessonsLearned: plan.lessonsLearned,
    suggestedActions: plan.suggestedActions,
    commercialIntelligence: pricing.thirdPartyInvestment > 0.01
      ? {
          whatWeLearnedToday: [
            `${pricing.thirdPartyName} dividiu R$${pricing.thirdPartyInvestment.toFixed(2)} do investimento (total R$${plan.purchase?.investment.toFixed(2) ?? "0"}).`,
            `Capital próprio na compra: R$${pricing.ownInvestment.toFixed(2)} — lucro operacional R$${plan.summary.profit.toFixed(2)}.`,
          ],
          conclusion: pricing.profitExplanation ?? undefined,
        }
      : undefined,
    tags: ["registro-dia", "operacao-real"],
  };
}

export interface DayRegistrationResult {
  saleIds: string[];
  clientIds: string[];
  diaryId: string;
}

export async function commitDayRegistration(rawPlan: DayRegistrationPlan): Promise<DayRegistrationResult> {
  const parsed = dayRegistrationPlanSchema.safeParse(rawPlan);
  if (!parsed.success) {
    throw new Error("Plano de registro inválido.");
  }

  const plan = parsed.data;
  const existingSalesCount = await countSalesForDay(plan.businessId, plan.date);
  if (existingSalesCount > 0) {
    throw new Error(
      `Dia ${plan.date} já possui ${existingSalesCount} venda(s). Registro abortado para preservar integridade.`,
    );
  }

  const pricing = resolveDayRegistrationPricing(plan);
  const purchaseForInvestments = plan.purchase
    ? {
        ...plan.purchase,
        ownInvestment: pricing.ownInvestment,
        thirdParty:
          pricing.thirdPartyInvestment > 0.01
            ? {
                name: pricing.thirdPartyName,
                amount: pricing.thirdPartyInvestment,
              }
            : plan.purchase.thirdParty,
      }
    : undefined;

  const products = await listProducts(plan.businessId);
  const { unitPrice, unitCostFull, unitCostOwn } = pricing;

  const productCache = new Map<string, string>();
  for (const product of products) {
    productCache.set(normalizeName(product.name), product.id);
  }

  const unknownId = await resolveOrCreateProductId(
    UNKNOWN_PRODUCT_NAME,
    plan.businessId,
    unitPrice,
    unitCostFull,
    productCache,
  );
  await syncProductCatalogPricing(unknownId, unitPrice, unitCostFull);

  if (plan.purchase?.products.length) {
    for (const item of plan.purchase.products) {
      const productId = await resolveOrCreateProductId(
        item.name,
        plan.businessId,
        unitPrice,
        unitCostFull,
        productCache,
      );
      await syncProductCatalogPricing(productId, unitPrice, unitCostFull);

      const product = await getProductById(productId);
      if (!product) continue;

      const newBalance = product.stockQuantity + item.quantity;
      await updateStockQuantity(productId, newBalance);
      await recordStockMovement({
        productId,
        type: "entry",
        quantity: item.quantity,
        balanceAfter: newBalance,
        reason: `Compra diária ${plan.date}`,
      });
    }
  }

  const existingClients = await listClientsRaw();
  const clientIdsByName = new Map(existingClients.map((c) => [normalizeName(c.name), c.id]));

  for (const spec of plan.newClients) {
    if (clientIdsByName.has(normalizeName(spec.name))) continue;
    const id = await createClient({
      businessId: plan.businessId,
      name: spec.name,
      sector: spec.sector ?? null,
      notes: spec.notes ?? null,
    });
    clientIdsByName.set(normalizeName(spec.name), id);
  }

  const saleIds: string[] = [];
  for (const sale of plan.sales) {
    const clientId = clientIdsByName.get(normalizeName(sale.clientName));
    if (!clientId) {
      throw new Error(`Cliente não resolvido: ${sale.clientName}`);
    }

    let productId = productCache.get(normalizeName(sale.productName));
    if (!productId) {
      productId = await resolveOrCreateProductId(
        sale.productName,
        plan.businessId,
        unitPrice,
        unitCostFull,
        productCache,
      );
      await syncProductCatalogPricing(productId, unitPrice, unitCostFull);
    }

    if (
      normalizeName(sale.productName).includes("nao identificado") ||
      normalizeName(sale.productName).includes("não identificado")
    ) {
      productId = unknownId;
    }

    const result = await executeSaleOperation({
      productId,
      quantity: sale.quantity,
      clientId,
      paymentMethod: sale.paymentMethod,
      paymentStatus: sale.paymentStatus ?? "paid",
      date: plan.date,
      time: sale.time,
      department: sale.department,
      notes: sale.notes ?? null,
      unitPrice,
      unitCost: unitCostOwn,
    });
    saleIds.push(result.saleId);
  }

  if (purchaseForInvestments && purchaseForInvestments.investment > 0) {
    await registerInvestments(plan.businessId, plan.date, purchaseForInvestments);
  }

  const diary = await upsertDiaryEntry(buildDiaryEntry(plan));

  return {
    saleIds,
    clientIds: Array.from(clientIdsByName.values()),
    diaryId: diary.id,
  };
}
