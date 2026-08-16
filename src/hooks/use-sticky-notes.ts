"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { generateId } from "@/shared/ids/generate-id";
import type { StickyNote, StickyNoteColor } from "@/lib/sticky-notes/types";
import {
  localClearPending,
  localDeleteNote,
  localGetPendingIds,
  localListNotes,
  localMarkPending,
  localPutNote,
  localPutNotes,
  mergeNotes,
} from "@/lib/sticky-notes/local-store";

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "error";

export type StickyNotePatch = Partial<
  Pick<StickyNote, "title" | "body" | "color" | "noteDate" | "pinned" | "archived" | "sortOrder">
>;

const SAVE_DEBOUNCE_MS = 450;

async function fetchNotes(includeArchived = false): Promise<StickyNote[]> {
  const qs = includeArchived ? "?archived=1" : "";
  const res = await fetch(`/api/sticky-notes${qs}`, { credentials: "include" });
  if (!res.ok) throw new Error("load failed");
  const data = await res.json();
  return (data.notes as StickyNote[]) ?? [];
}

async function putNoteToServer(note: StickyNote): Promise<StickyNote> {
  const res = await fetch("/api/sticky-notes", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note),
    keepalive: true,
  });
  if (!res.ok) throw new Error("save failed");
  const data = await res.json();
  return (data.note as StickyNote) ?? note;
}

async function putBatchToServer(notes: StickyNote[]): Promise<void> {
  if (notes.length === 0) return;
  await fetch("/api/sticky-notes", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
    keepalive: true,
  });
}

export function useStickyNotes() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [showArchived, setShowArchived] = useState(false);
  const notesRef = useRef<StickyNote[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const flushNote = useCallback(async (id: string) => {
    const note = notesRef.current.find((n) => n.id === id);
    if (!note) return;
    setStatus(navigator.onLine ? "saving" : "offline");
    try {
      await localPutNote(note);
      await localMarkPending(id);
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      const saved = await putNoteToServer(note);
      await localClearPending(id);
      pendingRef.current.delete(id);
      // Não sobrescreve se o usuário digitou mais enquanto salvava (ex.: espaços).
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          if (n.clientUpdatedAt > saved.clientUpdatedAt) {
            void localPutNote(n);
            return n;
          }
          void localPutNote(saved);
          return saved;
        }),
      );
      setStatus("saved");
    } catch {
      setStatus(navigator.onLine ? "error" : "offline");
    }
  }, []);

  const scheduleSave = useCallback(
    (id: string) => {
      pendingRef.current.add(id);
      const existing = timersRef.current.get(id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        void flushNote(id);
      }, SAVE_DEBOUNCE_MS);
      timersRef.current.set(id, timer);
    },
    [flushNote],
  );

  const flushAllPending = useCallback(async () => {
    Array.from(timersRef.current.values()).forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    const ids = Array.from(pendingRef.current);
    const batch = notesRef.current.filter((n) => ids.includes(n.id));
    for (const note of batch) {
      await localPutNote(note);
      await localMarkPending(note.id);
    }
    try {
      if (batch.length > 0 && navigator.onLine) {
        await putBatchToServer(batch);
        for (const note of batch) {
          await localClearPending(note.id);
          pendingRef.current.delete(note.id);
        }
        setStatus("saved");
      }
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const local = await localListNotes();
      if (!cancelled && local.length > 0) {
        setNotes(
          local
            .filter((n) => (showArchived ? true : !n.archived))
            .sort((a, b) => {
              if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
              return b.clientUpdatedAt.localeCompare(a.clientUpdatedAt);
            }),
        );
      }
      try {
        const server = await fetchNotes(showArchived);
        const merged = mergeNotes(server, local).filter((n) =>
          showArchived ? true : !n.archived,
        );
        if (!cancelled) {
          setNotes(merged);
          await localPutNotes(merged);
        }
        const pendingIds = await localGetPendingIds();
        for (const id of pendingIds) pendingRef.current.add(id);
        if (pendingIds.length > 0 && navigator.onLine) {
          const toFlush = merged.filter((n) => pendingIds.includes(n.id));
          await putBatchToServer(toFlush);
          for (const id of pendingIds) {
            await localClearPending(id);
            pendingRef.current.delete(id);
          }
        }
        if (!cancelled) setStatus("saved");
      } catch {
        if (!cancelled) setStatus(local.length > 0 ? "offline" : "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showArchived]);

  useEffect(() => {
    const onHide = () => {
      void flushAllPending();
    };
    const onOffline = () => setStatus("offline");
    const onOnline = () => {
      void flushAllPending();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      void flushAllPending();
    };
  }, [flushAllPending]);

  const createNote = useCallback(
    async (
      partial?: Partial<Pick<StickyNote, "title" | "body" | "color" | "noteDate">>,
    ) => {
      const now = new Date().toISOString();
      const note: StickyNote = {
        id: generateId(),
        title: partial?.title ?? "",
        body: partial?.body ?? "",
        color: partial?.color ?? "default",
        noteDate: partial?.noteDate !== undefined ? partial.noteDate : format(new Date(), "yyyy-MM-dd"),
        pinned: false,
        archived: false,
        sortOrder: 0,
        clientUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      setNotes((prev) => [note, ...prev]);
      await localPutNote(note);
      await localMarkPending(note.id);
      pendingRef.current.add(note.id);
      scheduleSave(note.id);
      return note;
    },
    [scheduleSave],
  );

  const updateNote = useCallback(
    (id: string, patch: StickyNotePatch) => {
      const now = new Date().toISOString();
      setNotes((prev) => {
        const next = prev.map((n) =>
          n.id === id ? { ...n, ...patch, clientUpdatedAt: now, updatedAt: now } : n,
        );
        const updated = next.find((n) => n.id === id);
        if (updated) void localPutNote(updated);
        return next;
      });
      pendingRef.current.add(id);
      void localMarkPending(id);
      scheduleSave(id);
    },
    [scheduleSave],
  );

  const applyBoardMove = useCallback(
    (ordered: StickyNote[]) => {
      const now = new Date().toISOString();
      setNotes((prev) => {
        const byId = new Map(prev.map((n) => [n.id, n]));
        for (const note of ordered) {
          byId.set(note.id, { ...note, clientUpdatedAt: now, updatedAt: now });
        }
        return Array.from(byId.values());
      });
      for (const note of ordered) {
        pendingRef.current.add(note.id);
        void localPutNote({ ...note, clientUpdatedAt: now, updatedAt: now });
        void localMarkPending(note.id);
        scheduleSave(note.id);
      }
    },
    [scheduleSave],
  );

  const setColor = useCallback(
    (id: string, color: StickyNoteColor) => updateNote(id, { color }),
    [updateNote],
  );

  const togglePin = useCallback(
    (id: string) => {
      const note = notesRef.current.find((n) => n.id === id);
      if (!note) return;
      updateNote(id, { pinned: !note.pinned });
    },
    [updateNote],
  );

  const archiveNote = useCallback(
    (id: string) => {
      updateNote(id, { archived: true });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    [updateNote],
  );

  const deleteNote = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await localDeleteNote(id);
    pendingRef.current.delete(id);
    try {
      await fetch(`/api/sticky-notes?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
        keepalive: true,
      });
      await localClearPending(id);
    } catch {
      setStatus("error");
    }
  }, []);

  return {
    notes,
    loading,
    status,
    showArchived,
    setShowArchived,
    createNote,
    updateNote,
    applyBoardMove,
    setColor,
    togglePin,
    archiveNote,
    deleteNote,
    flushAllPending,
  };
}
