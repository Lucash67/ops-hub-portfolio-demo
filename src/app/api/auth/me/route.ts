import { NextResponse } from "next/server";
import { toPublicUser } from "@/lib/auth/session";
import { apiError } from "@/shared/api-messages";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";

export async function GET() {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  return NextResponse.json({ user: toPublicUser(auth) });
}
