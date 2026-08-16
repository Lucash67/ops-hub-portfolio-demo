import type { DomainEventType, EffectAction } from "@/core/contracts";

export interface OperationReceivedPayload {
  operationId: string;
  source: string;
}

export interface OperationInterpretedPayload {
  operationId: string;
  operationType: string;
  confidence: number;
}

export interface OperationValidatedPayload {
  operationId: string;
  valid: boolean;
}

export interface OperationEffectSummary {
  entityType: string;
  entityId: string;
  action: EffectAction;
}

export interface OperationExecutedPayload {
  operationId: string;
  operationType: string;
  effects: OperationEffectSummary[];
}

export interface OperationRejectedPayload {
  operationId: string;
  errors: Array<{ code: string; message: string }>;
}

export interface OperationFailedPayload {
  operationId: string;
  error: { code: string; message: string };
}

export interface EventPayloadMap {
  "operation.received": OperationReceivedPayload;
  "operation.interpreted": OperationInterpretedPayload;
  "operation.validated": OperationValidatedPayload;
  "operation.executed": OperationExecutedPayload;
  "operation.rejected": OperationRejectedPayload;
  "operation.failed": OperationFailedPayload;
}

export type EventHandler<T extends DomainEventType> = (
  payload: EventPayloadMap[T],
) => void | Promise<void>;

export type UnsubscribeFn = () => void;
