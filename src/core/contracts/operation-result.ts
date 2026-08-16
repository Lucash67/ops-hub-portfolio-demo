import type { OperationStatus } from "./operation-types";
import type { DomainEvent } from "./domain-event";
import type { ExecutionResult } from "./execution-result";
import type { OperationInput } from "./operation-input";
import type { OperationInterpretation } from "./operation-interpretation";
import type { ValidationResult } from "./validation-result";

export interface OperationResult {
  operationId: string;
  status: OperationStatus;
  input: OperationInput;
  interpretation: OperationInterpretation;
  validation: ValidationResult;
  execution?: ExecutionResult;
  events: DomainEvent[];
  message: string;
  durationMs?: number;
  effectsCount?: number;
  eventsCount?: number;
  completedAt?: string;
}
