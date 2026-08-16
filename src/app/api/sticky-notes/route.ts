import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/shared/api-messages";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { stickyNoteUpsertSchema } from "@/lib/sticky-notes/types";
import {
  deleteStickyNote,
  listStickyNotes,
  upsertStickyNote,
} from "@/platform/db/repositories/sticky-note-repository";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    const includeArchived = request.nextUrl.searchParams.get("archived") === "1";
    const notes = await listStickyNotes(auth.id, { includeArchived });
    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Sticky notes GET error:", error);
    return apiError("Não foi possível carregar as notas.");
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    const body = await request.json();
    const parsed = stickyNoteUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Nota inválida.", 400);
    }

    const note = await upsertStickyNote(auth.id, {
      ...parsed.data,
      clientUpdatedAt: parsed.data.clientUpdatedAt || new Date().toISOString(),
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Sticky notes POST error:", error);
    return apiError("Não foi possível criar a nota.");
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    const body = await request.json();
    // Aceita uma nota ou um lote (flush ao fechar aba).
    const batch = Array.isArray(body?.notes) ? body.notes : [body];
    const saved = [];

    for (const item of batch) {
      const parsed = stickyNoteUpsertSchema.safeParse(item);
      if (!parsed.success) continue;
      if (!parsed.data.id && parsed.data.title === undefined && parsed.data.body === undefined) {
        continue;
      }
      const note = await upsertStickyNote(auth.id, {
        ...parsed.data,
        clientUpdatedAt: parsed.data.clientUpdatedAt || new Date().toISOString(),
      });
      saved.push(note);
    }

    return NextResponse.json({ notes: saved, note: saved[0] ?? null });
  } catch (error) {
    console.error("Sticky notes PUT error:", error);
    return apiError("Não foi possível salvar as notas.");
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return apiError("Nota não encontrada.", 400);
    const ok = await deleteStickyNote(auth.id, id);
    if (!ok) return apiError("Nota não encontrada.", 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sticky notes DELETE error:", error);
    return apiError("Não foi possível excluir a nota.");
  }
}
