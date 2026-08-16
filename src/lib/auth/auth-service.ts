import { createUser, findUserByEmail, updateUserPassword } from "@/platform/db/repositories/user-repository";
import {
  createPasswordResetToken,
  findValidResetToken,
  markResetTokenUsed,
} from "@/platform/db/repositories/password-reset-repository";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/auth/session";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_CREDENTIALS" | "EMAIL_TAKEN" | "VALIDATION",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function registerUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<SessionUser> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();

  if (!name) throw new AuthError("Informe seu nome", "VALIDATION");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError("E-mail inválido", "VALIDATION");
  }

  const passwordError = validatePasswordStrength(input.password);
  if (passwordError) throw new AuthError(passwordError, "VALIDATION");

  const existing = await findUserByEmail(email);
  if (existing) throw new AuthError("Este e-mail já está cadastrado", "EMAIL_TAKEN");

  const passwordHash = await hashPassword(input.password);
  const user = await createUser({ email, name, passwordHash });

  return { id: user.id, email: user.email, name: user.name };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<SessionUser> {
  const email = normalizeEmail(input.email);
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AuthError("E-mail ou senha incorretos", "INVALID_CREDENTIALS");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AuthError("E-mail ou senha incorretos", "INVALID_CREDENTIALS");
  }

  return { id: user.id, email: user.email, name: user.name };
}

export async function requestPasswordReset(email: string): Promise<{ token?: string }> {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AuthError("E-mail inválido", "VALIDATION");
  }

  const user = await findUserByEmail(normalized);
  if (!user) return {};

  const token = await createPasswordResetToken(user.id);
  return { token };
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
}): Promise<void> {
  const passwordError = validatePasswordStrength(input.password);
  if (passwordError) throw new AuthError(passwordError, "VALIDATION");

  const record = await findValidResetToken(input.token.trim());
  if (!record) {
    throw new AuthError("Link de recuperação inválido ou expirado", "VALIDATION");
  }

  const passwordHash = await hashPassword(input.password);
  await updateUserPassword(record.userId, passwordHash);
  await markResetTokenUsed(record.id);
}
