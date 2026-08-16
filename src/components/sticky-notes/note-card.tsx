"use client";

import { Archive, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STICKY_NOTE_COLOR_STYLES,
  type StickyNote,
} from "@/lib/sticky-notes/types";

interface NoteCardProps {
  note: StickyNote;
  onOpen: (note: StickyNote) => void;
  onTogglePin: (id: string) => void;
  onArchive: (id: string) => void;
}

export function NoteCard({
  note,
  onOpen,
  onTogglePin,
  onArchive,
}: NoteCardProps) {
  const colors = STICKY_NOTE_COLOR_STYLES[note.color] ?? STICKY_NOTE_COLOR_STYLES.default;
  const hasTitle = Boolean(note.title.trim());
  const preview = note.body.trim() || (hasTitle ? "" : "Nota vazia");

  return (
    <article
      className={cn(
        "group relative break-inside-avoid rounded-xl border transition-shadow hover:shadow-[0_1px_4px_rgba(0,0,0,0.5)]",
        colors.card,
        colors.border,
      )}
    >
      <button
        type="button"
        title={note.pinned ? "Desafixar" : "Fixar"}
        onClick={() => onTogglePin(note.id)}
        className={cn(
          "absolute right-1.5 top-1.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#e8eaed]/70 hover:bg-white/10 hover:text-[#e8eaed]",
          note.pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100",
        )}
      >
        <Pin className={cn("h-3.5 w-3.5", note.pinned && "fill-current")} />
      </button>

      <button
        type="button"
        onClick={() => onOpen(note)}
        className="w-full px-4 pb-2 pt-3.5 text-left"
      >
        {hasTitle && (
          <h3 className="mb-1.5 pr-8 text-[15px] font-medium leading-snug tracking-tight text-[#e8eaed]">
            {note.title}
          </h3>
        )}
        {preview ? (
          <p
            className={cn(
              "whitespace-pre-wrap text-sm leading-[1.5] text-[#e8eaed]/80 line-clamp-[12]",
              !hasTitle && "pr-8",
            )}
          >
            {preview}
          </p>
        ) : null}
      </button>

      <div className="flex items-center gap-0.5 px-1.5 pb-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          title="Arquivar"
          onClick={() => onArchive(note.id)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#e8eaed]/65 hover:bg-white/10 hover:text-[#e8eaed]"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}
