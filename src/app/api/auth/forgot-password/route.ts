import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requestPasswordReset } from "@/lib/auth/auth-service";
import { apiError } from "@/shared/api-messages";

const forgotSchema = z.object({
  email: z.string().email(),
});

const GENERIC_MSG =
  "Se este e-mail estiver cadastrado, você receberá instruções para redefinir a senha.";

export async function POST(request: NextRequest) {
  try {
    const { email } = forgotSchema.parse(await request.json());
    const { token } = await requestPasswordReset(email);

    const body: { message: string; resetUrl?: string } = { message: GENERIC_MSG };

    if (token && process.env.NODE_ENV !== "production") {
      const origin = request.nextUrl.origin;
      body.resetUrl = `${origin}/login?reset=${token}`;
    }

    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, 400);
    }
    if (error instanceof z.ZodError) {
      return apiError("Informe um e-mail válido.", 400);
    }
    console.error("Auth forgot-password error:", error);
    return NextResponse.json({ message: GENERIC_MSG });
  }
}
