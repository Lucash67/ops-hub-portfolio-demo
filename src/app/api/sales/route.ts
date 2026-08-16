import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { executeSaleOperation } from "@/domains/sales/sale-operation-handler";
import { MSG, apiError } from "@/shared/api-messages";
import { isEngineError } from "@/shared/errors/engine-errors";
import { listSalesEnriched, getSaleProduct } from "@/platform/db/repositories/sale-repository";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";
import { requireTenantBusinessWrite } from "@/lib/auth/tenant-scope";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      return NextResponse.json(await listSalesEnriched(scope.businessId));
    });
  } catch (error) {
    console.error("Sales GET error:", error);
    return apiError(MSG.LOAD_SALES);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    const body = await request.json();
    return await withTenantScope(auth, body.businessId, async (scope) => {
      const businessId = requireTenantBusinessWrite(scope, body.businessId);
      const { date, time, clientId, department, productId, quantity, paymentMethod, notes, paymentStatus } =
        body;

      if (!productId) {
        return apiError(MSG.SALE_NO_PRODUCT, 400);
      }

      const product = await getSaleProduct(productId);
      if (!product) {
        return apiError(MSG.SALE_NO_PRODUCT, 400);
      }
      if (product.businessId !== businessId) {
        return apiError("Produto não pertence à operação selecionada.", 400);
      }

      const qty = Number(quantity);
      if (!qty || qty <= 0) {
        return apiError(MSG.SALE_INVALID_QTY, 400);
      }

      const result = await executeSaleOperation({
        productId,
        quantity: qty,
        clientId: clientId || null,
        paymentMethod: paymentMethod || "pix",
        paymentStatus: paymentStatus || undefined,
        date: date ?? format(new Date(), "yyyy-MM-dd"),
        time: time ? time : undefined,
        department: department || null,
        notes: notes || null,
      });

      return NextResponse.json({ id: result.saleId, success: true }, { status: 201 });
    });
  } catch (error) {
    console.error("Sales POST error:", error);
    if (error instanceof Error && error.message.includes("operação específica")) {
      return apiError(error.message, 400);
    }
    if (isEngineError(error) && error.code === "EXECUTION_FAILED") {
      return apiError(error.message, 400);
    }
    return apiError(MSG.CREATE_SALE);
  }
}
