import type { OperationResult } from "@/core/contracts";

export function logOperationResult(result: OperationResult): void {
  const rawText = result.input.payloadType === "text" ? result.input.rawPayload : null;

  const entry = {
    operationId: result.operationId,
    createdAt: result.input.receivedAt,
    completedAt: result.completedAt,
    rawText,
    operationType: result.interpretation.operationType,
    status: result.status,
    durationMs: result.durationMs,
    effectsCount: result.effectsCount ?? result.execution?.effects.length ?? 0,
    eventsCount: result.eventsCount ?? result.events.length,
    errorMessage:
      result.status !== "executed"
        ? result.message
        : null,
  };

  if (result.status === "executed") {
    console.info("[BusinessEngine] operação concluída", entry);
  } else if (result.status === "rejected") {
    console.warn("[BusinessEngine] operação rejeitada", entry);
  } else {
    console.error("[BusinessEngine] operação falhou", entry);
  }
}
