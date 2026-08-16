import type {
  ExecutionResult,
  OperationContext,
  OperationInterpretation,
} from "@/core/contracts";
import { getOperationHandler } from "@/domains/registry/operation-handlers";
import { createEngineError } from "@/shared/errors/engine-errors";

export async function execute(
  interpretation: OperationInterpretation,
  context: OperationContext,
): Promise<ExecutionResult> {
  const started = Date.now();
  const handler = getOperationHandler(interpretation.operationType);

  if (!handler) {
    return {
      success: false,
      operationType: interpretation.operationType,
      effects: [],
      legacyRefs: [],
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      error: createEngineError(
        "HANDLER_NOT_FOUND",
        `Handler não encontrado para: ${interpretation.operationType}`,
      ),
    };
  }

  if (context.options.dryRun) {
    return {
      success: true,
      operationType: interpretation.operationType,
      effects: [],
      legacyRefs: [],
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    };
  }

  return handler(interpretation, context);
}
