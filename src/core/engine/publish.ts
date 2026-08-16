import type {
  DomainEvent,
  ExecutionResult,
  OperationContext,
  OperationInput,
  OperationInterpretation,
  OperationResult,
  ValidationResult,
} from "@/core/contracts";
import { getEventBus, registerListeners } from "@/core/event-bus";
import { operationRepository } from "@/platform/db/repositories/operation-repository";
import { generateId } from "@/shared/ids/generate-id";
import { logOperationResult } from "./operation-log";

function buildDomainEvent(
  type: DomainEvent["type"],
  operationId: string,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>,
): DomainEvent {
  return {
    id: generateId(),
    type,
    aggregateType,
    aggregateId,
    payload,
    operationId,
    occurredAt: new Date().toISOString(),
    version: 1,
  };
}

export async function publish(
  input: OperationInput,
  interpretation: OperationInterpretation,
  validation: ValidationResult,
  execution: ExecutionResult | undefined,
  context: OperationContext,
  startedAt: number,
): Promise<{ events: DomainEvent[]; result: OperationResult }> {
  const bus = getEventBus();
  registerListeners(bus);

  const events: DomainEvent[] = [];
  let status: OperationResult["status"] = "failed";
  let message = "Operação processada";
  let domainEvent: DomainEvent;

  if (!validation.valid) {
    status = "rejected";
    message = validation.errors.map((e) => e.message).join("; ") || "Operação inválida";

    domainEvent = buildDomainEvent(
      "operation.rejected",
      input.id,
      "operation",
      input.id,
      { errors: validation.errors },
    );
    events.push(domainEvent);
    await bus.publish("operation.rejected", {
      operationId: input.id,
      errors: validation.errors.map((e) => ({ code: e.code, message: e.message })),
    });
  } else if (!execution?.success) {
    status = "failed";
    message = execution?.error?.message ?? "Não foi possível concluir a operação";

    domainEvent = buildDomainEvent(
      "operation.failed",
      input.id,
      "operation",
      input.id,
      { error: execution?.error },
    );
    events.push(domainEvent);
    await bus.publish("operation.failed", {
      operationId: input.id,
      error: {
        code: execution?.error?.code ?? "UNKNOWN",
        message: execution?.error?.message ?? "Falha desconhecida",
      },
    });
  } else {
    status = "executed";
    message = "Operação executada com sucesso";

    domainEvent = buildDomainEvent(
      "operation.executed",
      input.id,
      "operation",
      input.id,
      {
        operationType: interpretation.operationType,
        effects: execution.effects.map((e) => ({
          entityType: e.entityType,
          entityId: e.entityId,
          action: e.action,
        })),
      },
    );
    events.push(domainEvent);

    await bus.publish("operation.executed", {
      operationId: input.id,
      operationType: interpretation.operationType,
      effects: execution.effects.map((e) => ({
        entityType: e.entityType,
        entityId: e.entityId,
        action: e.action,
      })),
    });
  }

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startedAt;
  const effectsCount = execution?.effects.length ?? 0;

  const result: OperationResult = {
    operationId: input.id,
    status,
    input,
    interpretation,
    validation,
    execution,
    events,
    message,
    durationMs,
    effectsCount,
    eventsCount: events.length,
    completedAt,
  };

  try {
    await operationRepository.finalize(result, domainEvent);
  } catch (error) {
    console.error("[BusinessEngine] falha ao persistir operação", {
      operationId: result.operationId,
      error,
    });
    await operationRepository.markFailed(
      result.operationId,
      "Não foi possível salvar a operação. Nenhuma alteração foi aplicada.",
      durationMs,
    );
    throw error;
  }
  logOperationResult(result);

  return { events, result };
}

export async function persistPending(
  input: OperationInput,
  correlationId: string,
): Promise<void> {
  await operationRepository.createPending(input, correlationId);
}
