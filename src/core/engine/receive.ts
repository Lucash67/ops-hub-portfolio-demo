import type { OperationContext, OperationInput } from "@/core/contracts";
import { normalizeTextInput } from "@/platform/adapters/text-input-adapter";

export function receive(raw: unknown, context: OperationContext): OperationInput {
  if (typeof raw === "string") {
    return normalizeTextInput(raw, {
      source: context.source,
      businessId: context.businessId,
    });
  }

  if (raw && typeof raw === "object" && "text" in raw && typeof raw.text === "string") {
    return normalizeTextInput(raw.text, {
      source: context.source,
      businessId: context.businessId,
    });
  }

  throw new Error("Entrada inválida: esperado texto ou objeto com campo 'text'");
}
