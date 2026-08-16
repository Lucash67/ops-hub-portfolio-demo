import type { OperationType } from "./operation-types";
import type { EffectRecord } from "./effect-record";
import type { EngineError } from "@/shared/errors/engine-errors";

export interface LegacyReference {
  entityType: string;
  entityId: string;
}

export interface ExecutionResult {
  success: boolean;
  operationType: OperationType;
  effects: EffectRecord[];
  legacyRefs: LegacyReference[];
  executedAt: string;
  durationMs: number;
  error?: EngineError;
}
