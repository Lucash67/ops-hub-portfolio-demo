import type {
  Ambiguity,
  InterpretedEntity,
  OperationContext,
  OperationInput,
  OperationInterpretation,
  OperationType,
} from "@/core/contracts";
import { getClientById, listClientsRaw } from "@/platform/db/repositories/client-repository";
import {
  getProductById,
  listProducts,
} from "@/platform/db/repositories/product-repository";
import type { LegacyClient, LegacyProduct } from "@/lib/db/types";

const TEXT_SALE_PATTERN =
  /^(\d+)\s+(.+?)\s+(\S+)\s+(pix|card|cash|dinheiro|cartao|cartão)$/i;

interface ParsedTextSale {
  quantity: number;
  productHint: string;
  clientHint: string;
  paymentMethod: "pix" | "card" | "cash";
}

function parsePayment(raw: string): "pix" | "card" | "cash" {
  const normalized = raw.toLowerCase();
  if (normalized === "pix") return "pix";
  if (normalized === "cash" || normalized === "dinheiro") return "cash";
  return "card";
}

function parseTextSale(text: string): ParsedTextSale | null {
  const match = text.trim().match(TEXT_SALE_PATTERN);
  if (!match) return null;

  return {
    quantity: Number(match[1]),
    productHint: match[2].trim(),
    clientHint: match[3].trim(),
    paymentMethod: parsePayment(match[4]),
  };
}

async function resolveProduct(
  hint: string,
  businessId: string,
): Promise<LegacyProduct | undefined> {
  const all = await listProducts(businessId);
  const lower = hint.toLowerCase();

  const exact = all.find((p) => p.name.toLowerCase() === lower);
  if (exact) return exact;

  return all.find((p) => p.name.toLowerCase().includes(lower));
}

async function resolveClient(hint: string): Promise<LegacyClient | undefined> {
  const all = await listClientsRaw();
  const lower = hint.toLowerCase();

  const exact = all.find((c) => c.name.toLowerCase() === lower);
  if (exact) return exact;

  return all.find((c) => c.name.toLowerCase().includes(lower));
}

export async function interpret(
  input: OperationInput,
  context: OperationContext,
): Promise<OperationInterpretation> {
  const now = new Date().toISOString();
  const ambiguities: Ambiguity[] = [];
  const entities: InterpretedEntity[] = [];

  let operationType: OperationType = "sale.create";
  let confidence = 0.5;

  const structured = input.structuredPayload;
  if (structured?.operationType) {
    operationType = structured.operationType;
  }

  if (structured?.productId || structured?.productHint) {
    const product = structured.productId
      ? await getProductById(structured.productId)
      : await resolveProduct(structured.productHint ?? "", context.businessId);

    if (product) {
      entities.push({
        type: "product",
        rawValue: structured.productHint ?? product.name,
        resolvedId: product.id,
        resolvedName: product.name,
        confidence: 0.9,
      });
      confidence = Math.max(confidence, 0.85);
    }
  }

  if (structured?.clientId || structured?.clientHint) {
    const client = structured.clientId
      ? await getClientById(structured.clientId)
      : await resolveClient(structured.clientHint ?? "");

    if (client) {
      entities.push({
        type: "client",
        rawValue: structured.clientHint ?? client.name,
        resolvedId: client.id,
        resolvedName: client.name,
        confidence: 0.85,
      });
    }
  }

  if (structured?.quantity) {
    entities.push({
      type: "quantity",
      rawValue: String(structured.quantity),
      confidence: 0.95,
    });
    confidence = Math.max(confidence, 0.9);
  }

  if (structured?.paymentMethod) {
    entities.push({
      type: "payment",
      rawValue: structured.paymentMethod,
      confidence: 0.95,
    });
  }

  if (!structured && input.payloadType === "text") {
    const parsed = parseTextSale(input.rawPayload);
    if (!parsed) {
      return {
        operationInputId: input.id,
        operationType: "sale.create",
        confidence: 0.1,
        entities: [],
        ambiguities: [
          {
            field: "text",
            candidates: [],
            message: "Formato não reconhecido. Use: quantidade produto cliente pagamento",
          },
        ],
        metadata: { parseFailed: true },
        interpretedAt: now,
      };
    }

    const product = await resolveProduct(parsed.productHint, context.businessId);
    const client = await resolveClient(parsed.clientHint);

    entities.push({
      type: "quantity",
      rawValue: String(parsed.quantity),
      confidence: 0.95,
    });

    entities.push({
      type: "payment",
      rawValue: parsed.paymentMethod,
      confidence: 0.9,
    });

    if (product) {
      entities.push({
        type: "product",
        rawValue: parsed.productHint,
        resolvedId: product.id,
        resolvedName: product.name,
        confidence: 0.8,
      });
    } else {
      ambiguities.push({
        field: "product",
        candidates: [],
        message: `Produto não encontrado: ${parsed.productHint}`,
      });
    }

    if (client) {
      entities.push({
        type: "client",
        rawValue: parsed.clientHint,
        resolvedId: client.id,
        resolvedName: client.name,
        confidence: 0.75,
      });
    } else {
      ambiguities.push({
        field: "client",
        candidates: [],
        message: `Cliente não encontrado: ${parsed.clientHint}`,
      });
    }

    confidence = product && client ? 0.75 : product ? 0.55 : 0.25;
  }

  return {
    operationInputId: input.id,
    operationType,
    confidence,
    entities,
    ambiguities,
    metadata: {},
    interpretedAt: now,
  };
}
