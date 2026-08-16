import { NextResponse } from "next/server";
import { ensureDemoData } from "@/lib/demo/ensure-demo-data";

/** Warm-up da demo (SQLite /tmp) — chamado no boot e sob demanda. */
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
