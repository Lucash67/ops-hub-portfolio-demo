import {
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const engineSchema = pgSchema("engine");

export const engineOperations = engineSchema.table(
  "operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    status: text("status", {
      enum: ["executed", "rejected", "failed", "pending"],
    }).notNull(),
    operationType: text("operation_type").notNull(),
    source: text("source").notNull(),
    correlationId: text("correlation_id").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    durationMs: integer("duration_ms"),
    effectsCount: integer("effects_count").notNull().default(0),
    eventsCount: integer("events_count").notNull().default(0),
    errorMessage: text("error_message"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessCreatedIdx: index("idx_engine_operations_business_created").on(
      table.businessId,
      table.createdAt,
    ),
    statusIdx: index("idx_engine_operations_status").on(table.status),
  }),
);

export const engineOperationPayloads = engineSchema.table("operation_payloads", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id")
    .notNull()
    .references(() => engineOperations.id),
  rawPayload: text("raw_payload").notNull(),
  payloadType: text("payload_type", { enum: ["text", "structured"] }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export const engineOperationInterpretations = engineSchema.table("operation_interpretations", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id")
    .notNull()
    .references(() => engineOperations.id),
  interpretation: jsonb("interpretation").notNull(),
  interpretedAt: timestamp("interpreted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const engineEffectRecords = engineSchema.table(
  "effect_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => engineOperations.id),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action", { enum: ["create", "update", "delete"] }).notNull(),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    entityIdx: index("idx_engine_effect_records_entity").on(table.entityType, table.entityId),
  }),
);

export const engineDomainEvents = engineSchema.table(
  "domain_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operationId: uuid("operation_id").references(() => engineOperations.id),
    eventType: text("event_type").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    payload: jsonb("payload").notNull(),
    version: integer("version").notNull().default(1),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventTypeIdx: index("idx_engine_domain_events_type_occurred").on(
      table.eventType,
      table.occurredAt,
    ),
  }),
);
