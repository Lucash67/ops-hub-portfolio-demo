import type { OperationContext, OperationInput, OperationResult } from "@/core/contracts";
import { operationRepository } from "@/platform/db/repositories/operation-repository";
import { isEngineError } from "@/shared/errors/engine-errors";
import { execute } from "./execute";
import { interpret } from "./interpret";
import { publish, persistPending } from "./publish";
import { receive } from "./receive";
import { validate } from "./validate";
import { getEventBus } from "@/core/event-bus";

const UNEXPECTED_ERROR = "Ocorreu um erro inesperado. Tente novamente em instantes.";

export class BusinessEngine {
  async process(raw: unknown, context: OperationContext): Promise<OperationResult> {
    const startedAt = Date.now();
    const bus = getEventBus();
    let input: OperationInput | undefined;

    try {
      input = receive(raw, context);
      await persistPending(input, context.correlationId);

      await bus.publish("operation.received", {
        operationId: input.id,
        source: input.source,
      });

      const interpretation = await interpret(input, context);

      await bus.publish("operation.interpreted", {
        operationId: input.id,
        operationType: interpretation.operationType,
        confidence: interpretation.confidence,
      });

      const validation = validate(interpretation, context);

      await bus.publish("operation.validated", {
        operationId: input.id,
        valid: validation.valid,
      });

      let execution = undefined;
      if (validation.valid) {
        execution = await execute(interpretation, context);
      }

      const { result } = await publish(
        input,
        interpretation,
        validation,
        execution,
        context,
        startedAt,
      );
      return result;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = isEngineError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : UNEXPECTED_ERROR;

      if (input?.id) {
        await operationRepository.markFailed(input.id, message, durationMs);
      }

      console.error("[BusinessEngine] erro no pipeline", {
        operationId: input?.id,
        durationMs,
        error,
      });

      throw error instanceof Error ? error : new Error(message);
    }
  }
}

let engineInstance: BusinessEngine | null = null;

export function getBusinessEngine(): BusinessEngine {
  if (!engineInstance) {
    engineInstance = new BusinessEngine();
  }
  return engineInstance;
}
