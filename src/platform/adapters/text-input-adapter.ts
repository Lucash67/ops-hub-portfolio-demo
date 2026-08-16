import type { OperationInput, OperationSource, StructuredPayload } from "@/core/contracts";
import { generateId } from "@/shared/ids/generate-id";

export interface TextAdapterOptions {
  source?: OperationSource;
  businessId?: string;
}

export function normalizeTextInput(
  rawText: string,
  options: TextAdapterOptions = {},
): OperationInput {
  const trimmed = rawText.trim();
  let structuredPayload: StructuredPayload | undefined;

  if (trimmed.startsWith("{")) {
    try {
      structuredPayload = JSON.parse(trimmed) as StructuredPayload;
    } catch {
      // Mantém como texto se JSON inválido
    }
  }

  return {
    id: generateId(),
    source: options.source ?? "text",
    rawPayload: trimmed,
    payloadType: structuredPayload ? "structured" : "text",
    structuredPayload,
    receivedAt: new Date().toISOString(),
    businessId: options.businessId ?? "default",
  };
}
