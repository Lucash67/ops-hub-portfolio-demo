import { NextResponse } from "next/server";
import { getSessionUser, toPublicUser } from "@/lib/auth/session";
import { apiError } from "@/shared/api-messages";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return apiError("Não autenticado", 401);
  return NextResponse.json({ user: toPublicUser(user) });
}
