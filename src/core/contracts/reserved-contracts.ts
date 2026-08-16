/**
 * Contratos reservados para sprints futuras.
 * Definidos aqui para estabilizar nomenclatura — sem implementação na Sprint 1.1.
 */

export interface LearningRecord {
  id: string;
  operationId: string;
  field: string;
  originalValue: string;
  correctedValue: string;
  businessId: string;
  createdAt: string;
}

export interface MemoryPattern {
  id: string;
  businessId: string;
  patternType: "alias" | "habit" | "preference" | "seasonality" | "correction";
  key: string;
  value: string;
  weight: number;
  lastSeenAt: string;
  createdAt: string;
}

export interface DerivationRequest {
  id: string;
  operationId: string;
  derivationType: "metrics" | "insights" | "goals" | "projections";
  requestedAt: string;
}

export interface ConfirmationRequest {
  operationId: string;
  interpretation: Record<string, unknown>;
  ambiguities: Record<string, unknown>[];
  expiresAt: string;
}
