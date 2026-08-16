import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "A senha deve ter no mínimo 8 caracteres";
  if (!/[A-Za-z]/.test(password)) return "A senha deve conter pelo menos uma letra";
  if (!/[0-9]/.test(password)) return "A senha deve conter pelo menos um número";
  return null;
}
