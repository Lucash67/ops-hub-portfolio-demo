import { NextResponse } from "next/server";
import { ensureDemoData } from "@/lib/demo/ensure-demo-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Warm-up da demo (SQLite /tmp) — sem auth. */
export async function GET() {
  try {
    process.env.DB_PROVIDER = "sqlite";
    await ensureDemoData();
    return NextResponse.json({ ok: true, demo: true });
  } catch (error) {
    console.error("demo ready error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "seed failed" },
      { status: 500 },
    );
  }
}
