export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  process.env.DB_PROVIDER = process.env.DB_PROVIDER ?? "sqlite";
  process.env.NEXT_PUBLIC_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE ?? "true";
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    process.env.AUTH_SECRET = "portfolio-demo-auth-secret-min-32-chars!!";
  }
  try {
    const { ensureDemoData } = await import("@/lib/demo/ensure-demo-data");
    await ensureDemoData();
  } catch (error) {
    console.error("[demo] ensureDemoData failed:", error);
  }
}
