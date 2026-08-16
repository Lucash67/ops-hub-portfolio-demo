import type { DomainEventType } from "@/core/contracts";
import type { EventHandler, EventPayloadMap, UnsubscribeFn } from "./event-types";

type HandlerEntry = {
  handler: EventHandler<DomainEventType>;
};

export interface EventBus {
  publish<T extends DomainEventType>(type: T, payload: EventPayloadMap[T]): Promise<void>;
  subscribe<T extends DomainEventType>(type: T, handler: EventHandler<T>): UnsubscribeFn;
}

export class InProcessEventBus implements EventBus {
  private listeners = new Map<DomainEventType, Set<HandlerEntry>>();

  subscribe<T extends DomainEventType>(type: T, handler: EventHandler<T>): UnsubscribeFn {
    const entry: HandlerEntry = {
      handler: handler as EventHandler<DomainEventType>,
    };

    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)!.add(entry);

    return () => {
      this.listeners.get(type)?.delete(entry);
    };
  }

  async publish<T extends DomainEventType>(type: T, payload: EventPayloadMap[T]): Promise<void> {
    const handlers = this.listeners.get(type);
    if (!handlers || handlers.size === 0) return;

    const results = await Promise.allSettled(
      Array.from(handlers).map(async (entry) => {
        await entry.handler(payload);
      }),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        console.error(`[EventBus] Listener error for "${type}":`, result.reason);
      }
    }
  }
}

let defaultBus: InProcessEventBus | null = null;

export function getEventBus(): InProcessEventBus {
  if (!defaultBus) {
    defaultBus = new InProcessEventBus();
  }
  return defaultBus;
}

export function resetEventBus(): void {
  defaultBus = null;
}
