import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { MSG, apiError } from "@/shared/api-messages";

function isDemoRuntime() {
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE !== "false" &&
    (process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
      Boolean(process.env.VERCEL) ||
      process.env.DEMO_SQLITE_TMP === "true")
  );
}

export async function requireApiSession(): Promise<SessionUser | NextResponse> {
  if (isDemoRuntime()) {
    try {
      const { ensureDemoData, DEMO_EMAIL } = await import("@/lib/demo/ensure-demo-data");
      await ensureDemoData();
      const session = await getSessionUser();
      if (!session) return apiError(MSG.AUTH_UNAUTHORIZED, 401);

      const { findUserByEmail, findUserById } = await import(
        "@/platform/db/repositories/user-repository"
      );
      const demoUser = await findUserByEmail(DEMO_EMAIL);
      const localUser = await findUserById(session.id);
      // Remap orphan JWTs (other /tmp instance) and the canonical demo login.
      if (
        demoUser &&
        (session.email.toLowerCase() === DEMO_EMAIL || !localUser)
      ) {
        return { id: demoUser.id, email: demoUser.email, name: demoUser.name };
      }
      return session;
    } catch (error) {
      console.error("Demo session bootstrap failed:", error);
      return apiError(MSG.AUTH_UNAUTHORIZED, 401);
    }
  }

  const user = await getSessionUser();
  if (!user) return apiError(MSG.AUTH_UNAUTHORIZED, 401);
  return user;
}

export function isAuthFailure(result: SessionUser | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
