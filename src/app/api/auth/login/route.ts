import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, loginUser } from "@/lib/auth/auth-service";
import {
  AUTH_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  toPublicUser,
} from "@/lib/auth/session";
import { MSG, apiError } from "@/shared/api-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.VERCEL) {
      const { ensureDemoData } = await import("@/lib/demo/ensure-demo-data");
      await ensureDemoData();
    }
    const body = loginSchema.parse(await request.json());
    const user = await loginUser(body);
    const token = await createSessionToken(user);
    const response = NextResponse.json({ user: toPublicUser(user) });
    response.cookies.set(AUTH_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, 401);
    }
    if (error instanceof z.ZodError) {
      return apiError("Informe e-mail e senha válidos.", 400);
    }
    console.error("Auth login error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      return apiError(`Demo login failed: ${detail}`, 500);
    }
    return apiError(MSG.AUTH_LOGIN_FAILED);
  }
}
