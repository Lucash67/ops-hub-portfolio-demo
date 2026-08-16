import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, registerUser } from "@/lib/auth/auth-service";
import {
  AUTH_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  toPublicUser,
} from "@/lib/auth/session";
import { MSG, apiError } from "@/shared/api-messages";

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const body = registerSchema.parse(await request.json());
    const user = await registerUser(body);
    const token = await createSessionToken(user);
    const response = NextResponse.json({ user: toPublicUser(user) });
    response.cookies.set(AUTH_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      const status = error.code === "EMAIL_TAKEN" ? 409 : 400;
      return apiError(error.message, status);
    }
    if (error instanceof z.ZodError) {
      return apiError("Dados inválidos. Verifique e-mail, nome e senha.", 400);
    }
    console.error("Auth register error:", error);
    return apiError(MSG.AUTH_REGISTER_FAILED);
  }
}
