import type { DomainEventType } from "./operation-types";

export interface DomainEvent {
  id: string;
  type: DomainEventType;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  operationId: string;
  occurredAt: string;
  version: number;
}
