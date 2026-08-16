import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";

export const operations = sqliteTable(
  "operations",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull().default("default"),
    status: text("status", {
      enum: ["executed", "rejected", "failed", "pending"],
    }).notNull(),
    operationType: text("operation_type").notNull(),
    source: text("source").notNull(),
    correlationId: text("correlation_id").notNull(),
    confidence: real("confidence"),
    durationMs: integer("duration_ms"),
    effectsCount: integer("effects_count").default(0),
    eventsCount: integer("events_count").default(0),
    errorMessage: text("error_message"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    businessCreatedIdx: index("idx_operations_business_created").on(
      table.businessId,
      table.createdAt,
    ),
    statusIdx: index("idx_operations_status").on(table.status),
  }),
);

export const operationPayloads = sqliteTable("operation_payloads", {
  id: text("id").primaryKey(),
  operationId: text("operation_id")
    .notNull()
    .references(() => operations.id),
  rawPayload: text("raw_payload").notNull(),
  payloadType: text("payload_type", { enum: ["text", "structured"] }).notNull(),
  receivedAt: text("received_at").notNull(),
});

export const operationInterpretations = sqliteTable("operation_interpretations", {
  id: text("id").primaryKey(),
  operationId: text("operation_id")
    .notNull()
    .references(() => operations.id),
  interpretationJson: text("interpretation_json").notNull(),
  interpretedAt: text("interpreted_at").notNull(),
});

export const effectRecords = sqliteTable(
  "effect_records",
  {
    id: text("id").primaryKey(),
    operationId: text("operation_id")
      .notNull()
      .references(() => operations.id),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action", { enum: ["create", "update", "delete"] }).notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    entityIdx: index("idx_effect_records_entity").on(table.entityType, table.entityId),
  }),
);

export const domainEvents = sqliteTable(
  "domain_events",
  {
    id: text("id").primaryKey(),
    operationId: text("operation_id").references(() => operations.id),
    eventType: text("event_type").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    payloadJson: text("payload_json").notNull(),
    version: integer("version").notNull().default(1),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => ({
    eventTypeIdx: index("idx_domain_events_type_occurred").on(
      table.eventType,
      table.occurredAt,
    ),
  }),
);

export type Operation = typeof operations.$inferSelect;
export type OperationPayload = typeof operationPayloads.$inferSelect;
export type OperationInterpretationRow = typeof operationInterpretations.$inferSelect;
export type EffectRecordRow = typeof effectRecords.$inferSelect;
export type DomainEventRow = typeof domainEvents.$inferSelect;
