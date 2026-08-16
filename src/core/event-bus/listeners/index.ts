import type { EventBus } from "../event-bus";

function logEngineEvent(label: string, payload: unknown): void {
  if (process.env.NODE_ENV === "development") {
    console.info(`[EventBus] ${label}`, payload);
  }
}

export function registerListeners(bus: EventBus): void {
  if (process.env.NODE_ENV !== "development") return;

  bus.subscribe("operation.received", (payload) => {
    logEngineEvent("operation.received", payload);
  });

  bus.subscribe("operation.interpreted", (payload) => {
    logEngineEvent("operation.interpreted", payload);
  });

  bus.subscribe("operation.validated", (payload) => {
    logEngineEvent("operation.validated", payload);
  });

  bus.subscribe("operation.rejected", (payload) => {
    logEngineEvent("operation.rejected", payload);
  });

  bus.subscribe("operation.failed", (payload) => {
    logEngineEvent("operation.failed", payload);
  });

  bus.subscribe("operation.executed", (payload) => {
    logEngineEvent("operation.executed", {
      ...payload,
      effectCount: payload.effects.length,
    });
  });
}
