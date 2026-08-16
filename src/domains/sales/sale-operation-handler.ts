import { format } from "date-fns";
import type { EffectRecord, OperationInterpretation } from "@/core/contracts";
import { createEngineError } from "@/shared/errors/engine-errors";
import type { PaymentStatus } from "@/lib/operational-data-service";
import { normalizeSaleShiftTime } from "@/lib/sale-shift";
import { executeSaleRecord } from "@/platform/db/repositories/sale-repository";
import { getClientById } from "@/platform/db/repositories/client-repository";
import { generateId } from "@/shared/ids/generate-id";

export interface SaleOperationParams {
  productId: string;
  quantity: number;
  clientId?: string | null;
  paymentMethod: "pix" | "card" | "cash";
  paymentStatus?: PaymentStatus;
  date?: string;
  time?: string;
  department?: string | null;
  notes?: string | null;
  unitPrice?: number;
  unitCost?: number;
}

export interface SaleOperationResult {
  saleId: string;
  effects: EffectRecord[];
}

export function extractSaleParams(interpretation: OperationInterpretation): SaleOperationParams | null {
  const product = interpretation.entities.find((e) => e.type === "product");
  const quantity = interpretation.entities.find((e) => e.type === "quantity");
  const client = interpretation.entities.find((e) => e.type === "client");
  const payment = interpretation.entities.find((e) => e.type === "payment");

  if (!product?.resolvedId || !quantity || !payment) return null;

  return {
    productId: product.resolvedId,
    quantity: Number(quantity.rawValue),
    clientId: client?.resolvedId ?? null,
    paymentMethod: payment.rawValue as "pix" | "card" | "cash",
    date: format(new Date(), "yyyy-MM-dd"),
    time: normalizeSaleShiftTime(format(new Date(), "HH:mm")),
    notes: null,
    department: null,
  };
}

export async function executeSaleOperation(params: SaleOperationParams): Promise<SaleOperationResult> {
  try {
    const saleId = await executeSaleRecord(params);
    const effects: EffectRecord[] = [
      {
        id: generateId(),
        entityType: "sale",
        entityId: saleId,
        action: "create",
        after: { id: saleId },
      },
    ];
    return { saleId, effects };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao registrar venda.";
    throw createEngineError("EXECUTION_FAILED", message);
  }
}

export async function resolveClientName(clientId: string | null | undefined): Promise<string | null> {
  if (!clientId) return null;
  const client = await getClientById(clientId);
  return client?.name ?? null;
}
