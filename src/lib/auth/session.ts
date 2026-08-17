import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const AUTH_COOKIE = "lh_hub_token";
/** Shared fallback so Edge middleware and Node API sign/verify the same JWT on Vercel demo. */
export const DEMO_AUTH_SECRET = "portfolio-demo-auth-secret-min-32-chars!!";
const SESSION_TTL = "7d";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) {
    return new TextEncoder().encode(secret);
  }
  // Portfolio demo: Node may inject AUTH_SECRET only in-process during seed;
  // Edge middleware must use the same constant or login redirects forever to /login.
  return new TextEncoder().encode(DEMO_AUTH_SECRET);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ sub: user.id, email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getAuthSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    const id = payload.sub;
    const email = payload.email;
    const name = payload.name;
    if (typeof id !== "string" || typeof email !== "string" || typeof name !== "string") {
      return null;
    }
    return { id, email, name };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function toPublicUser(user: SessionUser) {
  return { id: user.id, email: user.email, name: user.name };
}
