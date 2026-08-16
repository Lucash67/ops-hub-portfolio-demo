import type { OperationType } from "./operation-types";

export interface InterpretedEntity {
  type: "product" | "client" | "payment" | "quantity" | "date" | "notes" | "department";
  rawValue: string;
  resolvedId?: string;
  resolvedName?: string;
  confidence: number;
}

export interface Ambiguity {
  field: string;
  candidates: string[];
  message: string;
}

export interface OperationInterpretation {
  operationInputId: string;
  operationType: OperationType;
  confidence: number;
  entities: InterpretedEntity[];
  ambiguities: Ambiguity[];
  metadata: Record<string, unknown>;
  interpretedAt: string;
}
