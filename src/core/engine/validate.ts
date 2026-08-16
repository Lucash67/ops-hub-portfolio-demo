import type {
  OperationContext,
  OperationInterpretation,
  ValidationResult,
} from "@/core/contracts";

function findEntity(interpretation: OperationInterpretation, type: string) {
  return interpretation.entities.find((e) => e.type === type);
}

export function validate(
  interpretation: OperationInterpretation,
  _context: OperationContext,
): ValidationResult {
  const now = new Date().toISOString();
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];

  if (interpretation.ambiguities.some((a) => a.field === "text")) {
    errors.push({
      code: "INTERPRETATION_FAILED",
      field: "text",
      message: interpretation.ambiguities.find((a) => a.field === "text")?.message ?? "Interpretação falhou",
    });
  }

  if (interpretation.operationType === "sale.create") {
    const quantityEntity = findEntity(interpretation, "quantity");
    const productEntity = findEntity(interpretation, "product");
    const paymentEntity = findEntity(interpretation, "payment");

    const quantity = quantityEntity ? Number(quantityEntity.rawValue) : 0;

    if (!quantityEntity || quantity <= 0) {
      errors.push({
        code: "INVALID_QUANTITY",
        field: "quantity",
        message: "Quantidade deve ser maior que zero",
      });
    }

    if (!productEntity?.resolvedId) {
      errors.push({
        code: "PRODUCT_NOT_FOUND",
        field: "product",
        message: productEntity
          ? "Produto não resolvido"
          : "Produto não identificado na operação",
      });
    }

    if (!paymentEntity) {
      errors.push({
        code: "PAYMENT_REQUIRED",
        field: "payment",
        message: "Forma de pagamento não identificada",
      });
    }

    const clientEntity = findEntity(interpretation, "client");
    if (!clientEntity?.resolvedId) {
      warnings.push({
        code: "CLIENT_NOT_FOUND",
        field: "client",
        message: "Cliente não resolvido — venda será registrada sem cliente",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    validatedAt: now,
  };
}
