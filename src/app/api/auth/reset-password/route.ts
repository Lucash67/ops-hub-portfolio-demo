import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, resetPasswordWithToken } from "@/lib/auth/auth-service";
import { MSG, apiError } from "@/shared/api-messages";

const resetSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const body = resetSchema.parse(await request.json());
    await resetPasswordWithToken(body);
    return NextResponse.json({ ok: true, message: "Senha redefinida com sucesso." });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, 400);
    }
    if (error instanceof z.ZodError) {
      return apiError("Dados inválidos para redefinir a senha.", 400);
    }
    console.error("Auth reset-password error:", error);
    return apiError(MSG.AUTH_RESET_FAILED);
  }
}
