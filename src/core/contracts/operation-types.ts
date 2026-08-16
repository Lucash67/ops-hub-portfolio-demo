export type OperationSource = "text" | "api" | "form" | "import";

export type OperationType =
  | "sale.create"
  | "stock.adjust"
  | "stock.entry"
  | "stock.exit"
  | "expense.create"
  | "client.create"
  | "product.create";

export type OperationStatus = "executed" | "rejected" | "failed" | "pending";

export type PayloadType = "text" | "structured";

export type DomainEventType =
  | "operation.received"
  | "operation.interpreted"
  | "operation.validated"
  | "operation.executed"
  | "operation.rejected"
  | "operation.failed";

export type EffectAction = "create" | "update" | "delete";

export interface StructuredPayload {
  operationType?: OperationType;
  date?: string;
  time?: string;
  clientId?: string;
  clientHint?: string;
  productId?: string;
  productHint?: string;
  quantity?: number;
  paymentMethod?: "pix" | "card" | "cash";
  notes?: string;
  department?: string;
}
