import type { OperationInterpretation, OperationType } from "@/core/contracts";
import type { ExecutionResult } from "@/core/contracts";
import type { OperationContext } from "@/core/contracts";
import {
  executeSaleOperation,
  extractSaleParams,
} from "@/domains/sales/sale-operation-handler";
import { createEngineError, isEngineError } from "@/shared/errors/engine-errors";

export type OperationHandler = (
  interpretation: OperationInterpretation,
  context: OperationContext,
) => Promise<ExecutionResult>;

const handlers: Partial<Record<OperationType, OperationHandler>> = {
  "sale.create": async (interpretation, _context) => {
    const started = Date.now();
    const params = extractSaleParams(interpretation);

    if (!params) {
      return {
        success: false,
        operationType: "sale.create",
        effects: [],
        legacyRefs: [],
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        error: createEngineError("EXECUTION_FAILED", "Parâmetros de venda inválidos"),
      };
    }

    try {
      const result = await executeSaleOperation(params);
      return {
        success: true,
        operationType: "sale.create",
        effects: result.effects,
        legacyRefs: [{ entityType: "sale", entityId: result.saleId }],
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
      };
    } catch (error) {
      const message = isEngineError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : "Falha ao executar venda";
      return {
        success: false,
        operationType: "sale.create",
        effects: [],
        legacyRefs: [],
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        error: createEngineError("EXECUTION_FAILED", message),
      };
    }
  },
};

export function getOperationHandler(operationType: OperationType): OperationHandler | undefined {
  return handlers[operationType];
}

export function registerOperationHandler(
  operationType: OperationType,
  handler: OperationHandler,
): void {
  handlers[operationType] = handler;
}
