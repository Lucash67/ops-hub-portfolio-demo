import { desc, eq } from "drizzle-orm";
import type {
  DomainEvent,
  EffectRecord,
  OperationInput,
  OperationResult,
} from "@/core/contracts";
import { isPostgres, runInTransactionAsync } from "@/platform/db";
import { toDbBusinessId } from "@/platform/db/business-id";
import { getPostgresDb } from "@/platform/db/postgres/client";
import { getSqliteDb } from "@/platform/db/sqlite/client";
import {
  queryAll,
  queryOne,
  queryRun,
  toIsoTimestamp,
  toNumber,
} from "@/platform/db/query";
import {
  domainEvents as sqliteDomainEvents,
  effectRecords as sqliteEffectRecords,
  operationInterpretations as sqliteOperationInterpretations,
  operationPayloads as sqliteOperationPayloads,
  operations as sqliteOperations,
} from "@/platform/db/schema-operations";
import {
  engineDomainEvents,
  engineEffectRecords,
  engineOperationInterpretations,
  engineOperationPayloads,
  engineOperations,
} from "@/lib/db/postgres/schema-engine";
import { generateId } from "@/shared/ids/generate-id";

export interface OperationLogEntry {
  id: string;
  createdAt: string;
  completedAt: string | null;
  operationType: string;
  status: string;
  source: string;
  rawText: string | null;
  durationMs: number | null;
  effectsCount: number;
  eventsCount: number;
  errorMessage: string | null;
  confidence: number | null;
}

export class OperationRepository {
  async createPending(input: OperationInput, correlationId: string): Promise<void> {
    if (isPostgres()) {
      const db = await getPostgresDb();
      await db.transaction(async (tx) => {
        const now = new Date();
        await queryRun(
          tx.insert(engineOperations).values({
            id: input.id,
            businessId: toDbBusinessId(input.businessId),
            status: "pending",
            operationType: "sale.create",
            source: input.source,
            correlationId,
            confidence: null,
            durationMs: null,
            effectsCount: 0,
            eventsCount: 0,
            errorMessage: null,
            completedAt: null,
            createdAt: now,
          }),
        );
        await queryRun(
          tx.insert(engineOperationPayloads).values({
            id: generateId(),
            operationId: input.id,
            rawPayload: input.rawPayload,
            payloadType: input.payloadType,
            receivedAt: now,
          }),
        );
      });
      return;
    }

    await runInTransactionAsync(async () => {
      const db = getSqliteDb();
      const now = new Date().toISOString();

      await queryRun(
        db.insert(sqliteOperations).values({
          id: input.id,
          businessId: input.businessId,
          status: "pending",
          operationType: "sale.create",
          source: input.source,
          correlationId,
          confidence: null,
          durationMs: null,
          effectsCount: 0,
          eventsCount: 0,
          errorMessage: null,
          completedAt: null,
          createdAt: now,
        }),
      );

      await queryRun(
        db.insert(sqliteOperationPayloads).values({
          id: generateId(),
          operationId: input.id,
          rawPayload: input.rawPayload,
          payloadType: input.payloadType,
          receivedAt: input.receivedAt,
        }),
      );
    });
  }

  async finalize(result: OperationResult, domainEvent: DomainEvent): Promise<void> {
    const effectsCount = result.execution?.effects.length ?? 0;
    const eventsCount = result.events.length;
    const completedAt = result.completedAt ?? new Date().toISOString();
    const errorMessage =
      result.status === "rejected"
        ? result.validation.errors.map((e) => e.message).join("; ") || result.message
        : result.status === "failed"
          ? result.execution?.error?.message ?? result.message
          : null;

    if (isPostgres()) {
      const db = await getPostgresDb();
      await db.transaction(async (tx) => {
        await queryRun(
          tx
            .update(engineOperations)
            .set({
              status: result.status,
              operationType: result.interpretation.operationType,
              confidence: String(result.interpretation.confidence),
              durationMs: result.durationMs ?? result.execution?.durationMs ?? null,
              effectsCount,
              eventsCount,
              errorMessage,
              completedAt: new Date(completedAt),
            })
            .where(eq(engineOperations.id, result.operationId)),
        );

        await queryRun(
          tx.insert(engineOperationInterpretations).values({
            id: generateId(),
            operationId: result.operationId,
            interpretation: result.interpretation,
            interpretedAt: new Date(result.interpretation.interpretedAt),
          }),
        );

        if (result.execution?.effects.length) {
          for (const effect of result.execution.effects) {
            await this.saveEffect(result.operationId, effect, tx);
          }
        }

        await queryRun(
          tx.insert(engineDomainEvents).values({
            id: domainEvent.id,
            operationId: domainEvent.operationId,
            eventType: domainEvent.type,
            aggregateType: domainEvent.aggregateType,
            aggregateId: domainEvent.aggregateId,
            payload: domainEvent.payload,
            version: domainEvent.version,
            occurredAt: new Date(domainEvent.occurredAt),
          }),
        );
      });
      return;
    }

    await runInTransactionAsync(async () => {
      const db = getSqliteDb();

      await queryRun(
        db
          .update(sqliteOperations)
          .set({
            status: result.status,
            operationType: result.interpretation.operationType,
            confidence: result.interpretation.confidence,
            durationMs: result.durationMs ?? result.execution?.durationMs ?? null,
            effectsCount,
            eventsCount,
            errorMessage,
            completedAt,
          })
          .where(eq(sqliteOperations.id, result.operationId)),
      );

      await queryRun(
        db.insert(sqliteOperationInterpretations).values({
          id: generateId(),
          operationId: result.operationId,
          interpretationJson: JSON.stringify(result.interpretation),
          interpretedAt: result.interpretation.interpretedAt,
        }),
      );

      if (result.execution?.effects.length) {
        for (const effect of result.execution.effects) {
          await this.saveEffect(result.operationId, effect, db);
        }
      }

      await queryRun(
        db.insert(sqliteDomainEvents).values({
          id: domainEvent.id,
          operationId: domainEvent.operationId,
          eventType: domainEvent.type,
          aggregateType: domainEvent.aggregateType,
          aggregateId: domainEvent.aggregateId,
          payloadJson: JSON.stringify(domainEvent.payload),
          version: domainEvent.version,
          occurredAt: domainEvent.occurredAt,
        }),
      );
    });
  }

  async markFailed(operationId: string, errorMessage: string, durationMs: number): Promise<void> {
    const completedAt = new Date().toISOString();

    if (isPostgres()) {
      const db = await getPostgresDb();
      await queryRun(
        db
          .update(engineOperations)
          .set({
            status: "failed",
            errorMessage,
            durationMs,
            completedAt: new Date(completedAt),
            effectsCount: 0,
            eventsCount: 0,
          })
          .where(eq(engineOperations.id, operationId)),
      );
      return;
    }

    const db = getSqliteDb();
    await queryRun(
      db
        .update(sqliteOperations)
        .set({
          status: "failed",
          errorMessage,
          durationMs,
          completedAt,
          effectsCount: 0,
          eventsCount: 0,
        })
        .where(eq(sqliteOperations.id, operationId)),
    );
  }

  async saveEffect(
    operationId: string,
    effect: EffectRecord,
    dbOrTx?: Awaited<ReturnType<typeof getPostgresDb>> | ReturnType<typeof getSqliteDb>,
  ): Promise<void> {
    const now = new Date();

    if (isPostgres()) {
      const db = (dbOrTx ?? (await getPostgresDb())) as Awaited<ReturnType<typeof getPostgresDb>>;
      await queryRun(
        db.insert(engineEffectRecords).values({
          id: effect.id,
          operationId,
          entityType: effect.entityType,
          entityId: effect.entityId,
          action: effect.action,
          beforeState: effect.before ?? null,
          afterState: effect.after,
          createdAt: now,
        }),
      );
      return;
    }

    const db = (dbOrTx ?? getSqliteDb()) as ReturnType<typeof getSqliteDb>;
    await queryRun(
      db.insert(sqliteEffectRecords).values({
        id: effect.id,
        operationId,
        entityType: effect.entityType,
        entityId: effect.entityId,
        action: effect.action,
        beforeJson: effect.before ? JSON.stringify(effect.before) : null,
        afterJson: JSON.stringify(effect.after),
        createdAt: toIsoTimestamp(now),
      }),
    );
  }

  async findById(operationId: string) {
    if (isPostgres()) {
      const db = await getPostgresDb();
      return queryOne(
        db.select().from(engineOperations).where(eq(engineOperations.id, operationId)),
      );
    }

    const db = getSqliteDb();
    return queryOne(
      db.select().from(sqliteOperations).where(eq(sqliteOperations.id, operationId)),
    );
  }

  async listRecent(limit = 50): Promise<OperationLogEntry[]> {
    if (isPostgres()) {
      const db = await getPostgresDb();
      const rows = await queryAll(
        db.select().from(engineOperations).orderBy(desc(engineOperations.createdAt)).limit(limit),
      );

      const entries: OperationLogEntry[] = [];
      for (const row of rows) {
        const payload = await queryOne(
          db
            .select()
            .from(engineOperationPayloads)
            .where(eq(engineOperationPayloads.operationId, row.id)),
        );

        entries.push({
          id: row.id,
          createdAt: toIsoTimestamp(row.createdAt),
          completedAt: row.completedAt ? toIsoTimestamp(row.completedAt) : null,
          operationType: row.operationType,
          status: row.status,
          source: row.source,
          rawText: payload?.payloadType === "text" ? payload.rawPayload : null,
          durationMs: row.durationMs,
          effectsCount: row.effectsCount ?? 0,
          eventsCount: row.eventsCount ?? 0,
          errorMessage: row.errorMessage,
          confidence: row.confidence != null ? toNumber(row.confidence) : null,
        });
      }
      return entries;
    }

    const db = getSqliteDb();
    const rows = await queryAll(
      db.select().from(sqliteOperations).orderBy(desc(sqliteOperations.createdAt)).limit(limit),
    );

    const entries: OperationLogEntry[] = [];
    for (const row of rows) {
      const payload = await queryOne(
        db
          .select()
          .from(sqliteOperationPayloads)
          .where(eq(sqliteOperationPayloads.operationId, row.id)),
      );

      entries.push({
        id: row.id,
        createdAt: row.createdAt,
        completedAt: row.completedAt,
        operationType: row.operationType,
        status: row.status,
        source: row.source,
        rawText: payload?.payloadType === "text" ? payload.rawPayload : null,
        durationMs: row.durationMs,
        effectsCount: row.effectsCount ?? 0,
        eventsCount: row.eventsCount ?? 0,
        errorMessage: row.errorMessage,
        confidence: row.confidence,
      });
    }
    return entries;
  }
}

export const operationRepository = new OperationRepository();
