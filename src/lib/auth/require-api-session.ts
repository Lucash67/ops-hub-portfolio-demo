import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { MSG, apiError } from "@/shared/api-messages";

export async function requireApiSession(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return apiError(MSG.AUTH_UNAUTHORIZED, 401);
  return user;
}

export function isAuthFailure(result: SessionUser | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
