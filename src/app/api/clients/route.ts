import { NextRequest, NextResponse } from "next/server";
import { getClientCrmList, getClientCrmProfile } from "@/lib/client-crm-service";
import { MSG, apiError } from "@/shared/api-messages";
import { createClient, updateClient } from "@/platform/db/repositories/client-repository";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";
import { requireTenantBusinessWrite } from "@/lib/auth/tenant-scope";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      const { searchParams } = request.nextUrl;
      const id = searchParams.get("id");
      const businessId = scope.businessId;

      if (id) {
        const profile = await getClientCrmProfile(id, businessId);
        if (!profile) return apiError(MSG.CLIENT_NOT_FOUND, 404);
        return NextResponse.json({
          ...profile,
          purchaseCount: profile.summary.purchaseCount,
          totalSpent: profile.summary.totalSpent,
          favoriteProduct: profile.summary.favoriteProduct,
          lastPurchase: profile.summary.lastPurchaseDate
            ? { date: profile.summary.lastPurchaseDate, totalAmount: profile.summary.totalSpent }
            : null,
          isRecurring: profile.isRecurring,
          sales: profile.timeline.map((sale) => ({
            id: sale.id,
            date: sale.date,
            totalAmount: sale.totalAmount,
            paymentMethod: sale.paymentMethod,
          })),
        });
      }

      return NextResponse.json(await getClientCrmList(businessId));
    });
  } catch (error) {
    console.error("Clients GET error:", error);
    return apiError(MSG.LOAD_CLIENTS);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    const body = await request.json();
    return await withTenantScope(auth, body.businessId, async (scope) => {
      const businessId = requireTenantBusinessWrite(scope, body.businessId);

      if (!body.name?.trim()) {
        return apiError(MSG.CLIENT_NAME_REQUIRED, 400);
      }

      const id = await createClient({
        businessId,
        name: body.name.trim(),
        sector: body.sector || null,
        company: body.company || null,
        phone: body.phone || null,
        notes: body.notes || null,
      });

      return NextResponse.json({ id, success: true }, { status: 201 });
    });
  } catch (error) {
    console.error("Clients POST error:", error);
    if (error instanceof Error && error.message.includes("operação específica")) {
      return apiError(error.message, 400);
    }
    return apiError(MSG.CREATE_CLIENT);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, null, async () => {
      const body = await request.json();

      await updateClient({
        id: body.id,
        name: body.name,
        sector: body.sector,
        company: body.company,
        phone: body.phone,
        notes: body.notes,
      });

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error("Clients PUT error:", error);
    return apiError(MSG.UPDATE_CLIENT);
  }
}
