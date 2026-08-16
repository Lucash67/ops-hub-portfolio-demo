import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getPostgresDb, runInTransactionAsync } from "@/platform/db";
import { fromDbBusinessId, toDbBusinessId } from "@/platform/db/business-id";
import { getTenantDbIds } from "@/lib/auth/tenant-context";
import { isAllBusinesses } from "@/lib/business-units";
import { ensureOperationDayId } from "@/platform/db/repositories/operation-day-repository";
import { listProducts } from "@/platform/db/repositories/product-repository";
import { queryAll, queryOne, queryRun, toNumber } from "@/platform/db/query";
import {
  dailyPurchaseItems,
  dailyPurchases,
  diaryEntries,
  operationDays,
  operationalActions,
  operationalLessons,
  operationalLosses,
  productHypotheses,
} from "@/lib/db/postgres/schema";
import {
  DIARY_SCHEMA_VERSION,
  operationalDiaryEntrySchema,
  type OperationalDiaryEntry,
} from "@/lib/diary/types";
import { generateId } from "@/shared/ids/generate-id";

export type DiaryRecord = OperationalDiaryEntry & { id: string; createdAt: string };

type DiaryNarrative = {
  sales?: OperationalDiaryEntry["sales"];
  lossReason?: string;
  bonusIncome?: number;
  bonusIncomeDescription?: string;
};

interface OperationDayRow {
  id: string;
  businessId: string;
  operationDate: string;
  dailyGoalUnits: number | null;
}

interface DiaryRow {
  id: string;
  operationDayId: string;
  schemaVersion: number;
  revenueReceived: string;
  revenuePending: string;
  revenueTotal: string;
  operationalProfit: string;
  quantitySold: number;
  quantityLost: number;
  observations: string | null;
  manualInsights: string | null;
  commercialIntelligence: OperationalDiaryEntry["commercialIntelligence"] | null;
  tags: string[] | null;
  narrative: DiaryNarrative | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RelatedDiaryData {
  purchase: (typeof dailyPurchases.$inferSelect & { items: (typeof dailyPurchaseItems.$inferSelect)[] }) | null;
  losses: (typeof operationalLosses.$inferSelect)[];
  actions: (typeof operationalActions.$inferSelect)[];
  hypotheses: (typeof productHypotheses.$inferSelect)[];
  lessons: (typeof operationalLessons.$inferSelect)[];
}

async function getOperationDayRow(
  businessSlug: string,
  date: string,
): Promise<OperationDayRow | undefined> {
  const db = await getPostgresDb();
  const row = await queryOne(
    db
      .select()
      .from(operationDays)
      .where(
        and(
          eq(operationDays.businessId, toDbBusinessId(businessSlug)),
          eq(operationDays.operationDate, date),
        ),
      ),
  );
  if (!row) return undefined;
  return {
    id: row.id,
    businessId: row.businessId,
    operationDate: row.operationDate,
    dailyGoalUnits: row.dailyGoalUnits,
  };
}

async function loadRelatedData(operationDayId: string): Promise<RelatedDiaryData> {
  const db = await getPostgresDb();

  const purchaseRow = await queryOne(
    db.select().from(dailyPurchases).where(eq(dailyPurchases.operationDayId, operationDayId)),
  );

  const purchase = purchaseRow
    ? {
        ...purchaseRow,
        items: await queryAll(
          db
            .select()
            .from(dailyPurchaseItems)
            .where(eq(dailyPurchaseItems.dailyPurchaseId, purchaseRow.id)),
        ),
      }
    : null;

  const [losses, actions, hypotheses, lessons] = await Promise.all([
    queryAll(
      db.select().from(operationalLosses).where(eq(operationalLosses.operationDayId, operationDayId)),
    ),
    queryAll(
      db
        .select()
        .from(operationalActions)
        .where(eq(operationalActions.operationDayId, operationDayId)),
    ),
    queryAll(
      db
        .select()
        .from(productHypotheses)
        .where(eq(productHypotheses.operationDayId, operationDayId)),
    ),
    queryAll(
      db
        .select()
        .from(operationalLessons)
        .where(eq(operationalLessons.operationDayId, operationDayId)),
    ),
  ]);

  return { purchase, losses, actions, hypotheses, lessons };
}

function assembleDiaryRecord(
  day: OperationDayRow,
  diary: DiaryRow,
  related: RelatedDiaryData,
): DiaryRecord {
  const businessId = fromDbBusinessId(day.businessId);
  const narrative = (diary.narrative ?? {}) as DiaryNarrative;
  const lesson = related.lessons[0];

  const entry: OperationalDiaryEntry = {
    version: DIARY_SCHEMA_VERSION,
    businessId,
    date: day.operationDate,
    dailyGoalUnits: day.dailyGoalUnits ?? undefined,
    purchase: related.purchase
      ? {
          totalUnits: related.purchase.totalUnits,
          investment: toNumber(related.purchase.totalInvestment),
          products: related.purchase.items.map((item) => ({
            name: item.productName,
            quantity: item.quantity,
          })),
        }
      : undefined,
    sales: narrative.sales,
    revenue: {
      received: toNumber(diary.revenueReceived),
      pending: toNumber(diary.revenuePending),
      total: toNumber(diary.revenueTotal),
    },
    profit: toNumber(diary.operationalProfit),
    bonusIncome: narrative.bonusIncome,
    bonusIncomeDescription: narrative.bonusIncomeDescription,
    quantitySold: diary.quantitySold,
    quantityLost: Math.max(
      Number(diary.quantityLost) || 0,
      related.losses.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0),
    ),
    lossReason: narrative.lossReason ?? related.losses[0]?.reason ?? undefined,
    observations: diary.observations ?? undefined,
    manualInsights: diary.manualInsights ?? undefined,
    lessonsLearned: lesson?.content ?? undefined,
    commercialIntelligence: diary.commercialIntelligence ?? undefined,
    suggestedActions: related.actions.map((action) => ({
      id: action.externalId ?? action.id,
      title: action.title,
      description: action.description,
      status: action.status,
    })),
    productHypotheses: related.hypotheses.map((row) => ({
      flavor: row.flavor,
      hypothesis: row.hypothesis,
      confirmed: row.confirmed,
    })),
    tags: diary.tags?.length ? diary.tags : lesson?.tags?.length ? lesson.tags : undefined,
  };

  return {
    ...operationalDiaryEntrySchema.parse(entry),
    id: diary.id,
    createdAt: diary.createdAt.toISOString(),
  };
}

async function resolveProductId(businessSlug: string, productName: string): Promise<string | null> {
  const products = await listProducts(businessSlug);
  const normalized = productName.toLowerCase();
  const match = products.find((product) => {
    const name = product.name.toLowerCase();
    return name.includes(normalized) || normalized.includes(name.split(" ")[0] ?? "");
  });
  return match?.id ?? null;
}

export async function syncDiaryRelationalTables(
  operationDayId: string,
  entry: OperationalDiaryEntry,
): Promise<void> {
  const validated = operationalDiaryEntrySchema.parse(entry);
  const db = await getPostgresDb();
  const now = new Date();

  await queryRun(
    db.delete(operationalLosses).where(eq(operationalLosses.operationDayId, operationDayId)),
  );
  if (validated.quantityLost > 0) {
    await queryRun(
      db.insert(operationalLosses).values({
        id: generateId(),
        operationDayId,
        productId: null,
        productName: "Não especificado",
        quantity: validated.quantityLost,
        reason: validated.lossReason ?? null,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  const existingPurchase = await queryOne(
    db.select().from(dailyPurchases).where(eq(dailyPurchases.operationDayId, operationDayId)),
  );

  if (validated.purchase && validated.purchase.totalUnits > 0) {
    const purchaseId = existingPurchase?.id ?? generateId();
    if (existingPurchase) {
      await queryRun(
        db
          .update(dailyPurchases)
          .set({
            totalUnits: validated.purchase.totalUnits,
            totalInvestment: String(validated.purchase.investment),
            updatedAt: now,
          })
          .where(eq(dailyPurchases.id, purchaseId)),
      );
      await queryRun(
        db.delete(dailyPurchaseItems).where(eq(dailyPurchaseItems.dailyPurchaseId, purchaseId)),
      );
    } else {
      await queryRun(
        db.insert(dailyPurchases).values({
          id: purchaseId,
          operationDayId,
          totalUnits: validated.purchase.totalUnits,
          totalInvestment: String(validated.purchase.investment),
          createdAt: now,
          updatedAt: now,
        }),
      );
    }

    for (const line of validated.purchase.products) {
      const unitCost =
        validated.purchase.investment > 0 && validated.purchase.totalUnits > 0
          ? validated.purchase.investment / validated.purchase.totalUnits
          : null;
      await queryRun(
        db.insert(dailyPurchaseItems).values({
          id: generateId(),
          dailyPurchaseId: purchaseId,
          productId: await resolveProductId(validated.businessId, line.name),
          productName: line.name,
          quantity: line.quantity,
          unitCost: unitCost != null ? String(unitCost) : null,
        }),
      );
    }
  } else if (existingPurchase) {
    await queryRun(
      db
        .delete(dailyPurchaseItems)
        .where(eq(dailyPurchaseItems.dailyPurchaseId, existingPurchase.id)),
    );
    await queryRun(db.delete(dailyPurchases).where(eq(dailyPurchases.id, existingPurchase.id)));
  }

  await queryRun(
    db.delete(operationalActions).where(eq(operationalActions.operationDayId, operationDayId)),
  );
  for (const action of validated.suggestedActions ?? []) {
    await queryRun(
      db.insert(operationalActions).values({
        id: generateId(),
        operationDayId,
        externalId: action.id,
        title: action.title,
        description: action.description,
        status: action.status,
        source: "diary",
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  await queryRun(
    db.delete(productHypotheses).where(eq(productHypotheses.operationDayId, operationDayId)),
  );
  for (const hypothesis of validated.productHypotheses ?? []) {
    await queryRun(
      db.insert(productHypotheses).values({
        id: generateId(),
        operationDayId,
        flavor: hypothesis.flavor,
        hypothesis: hypothesis.hypothesis,
        confirmed: hypothesis.confirmed,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  await queryRun(
    db.delete(operationalLessons).where(eq(operationalLessons.operationDayId, operationDayId)),
  );
  if (validated.lessonsLearned?.trim()) {
    await queryRun(
      db.insert(operationalLessons).values({
        id: generateId(),
        operationDayId,
        content: validated.lessonsLearned.trim(),
        tags: validated.tags ?? [],
        createdAt: now,
        updatedAt: now,
      }),
    );
  }
}

export async function getDiaryEntryRecord(
  businessSlug: string,
  date: string,
): Promise<DiaryRecord | null> {
  const day = await getOperationDayRow(businessSlug, date);
  if (!day) return null;

  const db = await getPostgresDb();
  const diary = await queryOne(
    db.select().from(diaryEntries).where(eq(diaryEntries.operationDayId, day.id)),
  );
  if (!diary) return null;

  const related = await loadRelatedData(day.id);
  return assembleDiaryRecord(day, diary as DiaryRow, related);
}

export async function listDiaryEntryRecords(
  businessSlug: string,
  from?: string,
  to?: string,
): Promise<DiaryRecord[]> {
  const db = await getPostgresDb();
  const conditions = [];

  if (isAllBusinesses(businessSlug)) {
    const tenantIds = getTenantDbIds();
    // Sem escopo de tenant não listamos diários de todos — evita vazamento e UUID inválido.
    if (!tenantIds || tenantIds.length === 0) return [];
    conditions.push(inArray(operationDays.businessId, tenantIds));
  } else {
    conditions.push(eq(operationDays.businessId, toDbBusinessId(businessSlug)));
  }

  if (from) conditions.push(gte(operationDays.operationDate, from));
  if (to) conditions.push(lte(operationDays.operationDate, to));

  const rows = await queryAll(
    db
      .select({ day: operationDays, diary: diaryEntries })
      .from(operationDays)
      .innerJoin(diaryEntries, eq(diaryEntries.operationDayId, operationDays.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(operationDays.operationDate)),
  );

  const records: DiaryRecord[] = [];
  for (const row of rows) {
    const related = await loadRelatedData(row.day.id);
    records.push(
      assembleDiaryRecord(
        {
          id: row.day.id,
          businessId: row.day.businessId,
          operationDate: row.day.operationDate,
          dailyGoalUnits: row.day.dailyGoalUnits,
        },
        row.diary as DiaryRow,
        related,
      ),
    );
  }
  return records;
}

export async function upsertDiaryEntryRecord(entry: OperationalDiaryEntry): Promise<{ id: string }> {
  const validated = operationalDiaryEntrySchema.parse(entry);

  return runInTransactionAsync(async () => {
    const operationDayId = await ensureOperationDayId(validated.businessId, validated.date);
    const db = await getPostgresDb();
    const now = new Date();

    await queryRun(
      db
        .update(operationDays)
        .set({
          dailyGoalUnits: validated.dailyGoalUnits ?? null,
          updatedAt: now,
        })
        .where(eq(operationDays.id, operationDayId)),
    );

    const narrative: DiaryNarrative = {
      sales: validated.sales,
      lossReason: validated.lossReason,
      bonusIncome: validated.bonusIncome,
      bonusIncomeDescription: validated.bonusIncomeDescription,
    };

    const existing = await queryOne(
      db.select().from(diaryEntries).where(eq(diaryEntries.operationDayId, operationDayId)),
    );

    const diaryValues = {
      schemaVersion: validated.version,
      revenueReceived: String(validated.revenue.received),
      revenuePending: String(validated.revenue.pending ?? 0),
      revenueTotal: String(validated.revenue.total),
      operationalProfit: String(validated.profit),
      quantitySold: validated.quantitySold,
      quantityLost: validated.quantityLost,
      observations: validated.observations ?? null,
      manualInsights: validated.manualInsights ?? null,
      commercialIntelligence: validated.commercialIntelligence ?? null,
      tags: validated.tags ?? [],
      narrative,
      updatedAt: now,
    };

    let diaryId: string;
    if (existing) {
      diaryId = existing.id;
      await queryRun(
        db.update(diaryEntries).set(diaryValues).where(eq(diaryEntries.id, existing.id)),
      );
    } else {
      diaryId = generateId();
      await queryRun(
        db.insert(diaryEntries).values({
          id: diaryId,
          operationDayId,
          ...diaryValues,
          createdAt: now,
        }),
      );
    }

    await syncDiaryRelationalTables(operationDayId, validated);
    return { id: diaryId };
  });
}

export async function deleteDiaryEntryRecord(businessSlug: string, date: string): Promise<boolean> {
  const day = await getOperationDayRow(businessSlug, date);
  if (!day) return false;

  const db = await getPostgresDb();
  const existing = await queryOne(
    db.select().from(diaryEntries).where(eq(diaryEntries.operationDayId, day.id)),
  );
  if (!existing) return false;

  await runInTransactionAsync(async () => {
    await queryRun(db.delete(diaryEntries).where(eq(diaryEntries.id, existing.id)));
    await queryRun(
      db
        .update(operationDays)
        .set({ dailyGoalUnits: null, updatedAt: new Date() })
        .where(eq(operationDays.id, day.id)),
    );
    await syncDiaryRelationalTables(day.id, {
      version: DIARY_SCHEMA_VERSION,
      businessId: businessSlug,
      date,
      revenue: { received: 0, pending: 0, total: 0 },
      profit: 0,
      quantitySold: 0,
      quantityLost: 0,
    });
  });

  return true;
}

export async function getOperationDayIdForDate(
  businessSlug: string,
  date: string,
): Promise<string | null> {
  const day = await getOperationDayRow(businessSlug, date);
  return day?.id ?? null;
}
