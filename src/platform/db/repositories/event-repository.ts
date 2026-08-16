import type { DomainEvent } from "@/core/contracts";
import { isPostgres } from "@/platform/db";
import { getPostgresDb } from "@/platform/db/postgres/client";
import { getSqliteDb } from "@/platform/db/sqlite/client";
import { queryRun } from "@/platform/db/query";
import { domainEvents as sqliteDomainEvents } from "@/platform/db/schema-operations";
import { engineDomainEvents } from "@/lib/db/postgres/schema-engine";

export class EventRepository {
  async append(event: DomainEvent): Promise<void> {
    if (isPostgres()) {
      const db = await getPostgresDb();
      await queryRun(
        db.insert(engineDomainEvents).values({
          id: event.id,
          operationId: event.operationId,
          eventType: event.type,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          payload: event.payload,
          version: event.version,
          occurredAt: new Date(event.occurredAt),
        }),
      );
      return;
    }

    const db = getSqliteDb();
    await queryRun(
      db.insert(sqliteDomainEvents).values({
        id: event.id,
        operationId: event.operationId,
        eventType: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payloadJson: JSON.stringify(event.payload),
        version: event.version,
        occurredAt: event.occurredAt,
      }),
    );
  }
}

export const eventRepository = new EventRepository();
