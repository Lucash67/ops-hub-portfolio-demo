"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  CalendarDays,
  Check,
  ImagePlus,
  MoreVertical,
  Palette,
  Pin,
  Redo2,
  Trash2,
  Undo2,
  UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  STICKY_NOTE_COLORS,
  STICKY_NOTE_COLOR_STYLES,
  type StickyNote,
  type StickyNoteColor,
} from "@/lib/sticky-notes/types";
import { formatNoteDateLabel } from "@/lib/sticky-notes/week-board";

interface NoteEditorProps {
  note: StickyNote;
  onChange: (
    id: string,
    patch: Partial<
      Pick<StickyNote, "title" | "body" | "color" | "noteDate" | "pinned" | "archived">
    >,
  ) => void;
  onClose: () => void;
  onTogglePin: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onSetColor: (id: string, color: StickyNoteColor) => void;
}

type Snapshot = { title: string; body: string };

function ToolbarButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      // Evita roubar o foco do input/textarea (Espaço/Enter ativariam o botão).
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#e8eaed]/75 transition-colors sm:h-9 sm:w-9",
        disabled
          ? "cursor-default opacity-30"
          : "hover:bg-white/10 hover:text-[#e8eaed] active:bg-white/15",
      )}
    >
      {children}
    </button>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function NoteEditor({
  note,
  onChange,
  onClose,
  onTogglePin,
  onArchive,
  onDelete,
  onSetColor,
}: NoteEditorProps) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const skipHistory = useRef(false);
  /** Evita re-render do board a cada tecla (causa jump de scroll). */
  const propagateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rascunho local: evita que o autosave/re-render do board apague teclas (ex.: espaço).
  const [draftTitle, setDraftTitle] = useState(note.title);
  const [draftBody, setDraftBody] = useState(note.body);
  const draftRef = useRef({ title: note.title, body: note.body });
  const noteIdRef = useRef(note.id);

  const colors = STICKY_NOTE_COLOR_STYLES[note.color] ?? STICKY_NOTE_COLOR_STYLES.default;

  const flushDraftToParent = useCallback(() => {
    if (propagateTimer.current) {
      clearTimeout(propagateTimer.current);
      propagateTimer.current = null;
    }
    const draft = draftRef.current;
    onChange(noteIdRef.current, { title: draft.title, body: draft.body });
  }, [onChange]);

  const schedulePropagate = useCallback(() => {
    if (propagateTimer.current) clearTimeout(propagateTimer.current);
    propagateTimer.current = setTimeout(() => {
      propagateTimer.current = null;
      const draft = draftRef.current;
      onChange(noteIdRef.current, { title: draft.title, body: draft.body });
    }, 220);
  }, [onChange]);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (draftRef.current.title.trim()) {
        bodyRef.current?.focus({ preventScroll: true });
      } else {
        titleRef.current?.focus({ preventScroll: true });
      }
    });
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (noteIdRef.current === note.id) return;
    flushDraftToParent();
    noteIdRef.current = note.id;
    setDraftTitle(note.title);
    setDraftBody(note.body);
    draftRef.current = { title: note.title, body: note.body };
    setPast([]);
    setFuture([]);
    skipHistory.current = false;
    requestAnimationFrame(() => {
      if (note.title.trim()) bodyRef.current?.focus({ preventScroll: true });
      else titleRef.current?.focus({ preventScroll: true });
    });
  }, [flushDraftToParent, note.id, note.title, note.body]);

  useEffect(() => {
    return () => {
      if (propagateTimer.current) clearTimeout(propagateTimer.current);
    };
  }, []);

  const pushHistory = useCallback((next: Snapshot, prev: Snapshot) => {
    if (skipHistory.current) {
      skipHistory.current = false;
      return;
    }
    if (prev.title === next.title && prev.body === next.body) return;
    setPast((stack) => [...stack.slice(-40), prev]);
    setFuture([]);
  }, []);

  const commitTitle = useCallback(
    (title: string) => {
      const prev = draftRef.current;
      const next = { title, body: prev.body };
      pushHistory(next, prev);
      draftRef.current = next;
      setDraftTitle(title);
      schedulePropagate();
    },
    [pushHistory, schedulePropagate],
  );

  const commitBody = useCallback(
    (body: string) => {
      const prev = draftRef.current;
      const next = { title: prev.title, body };
      pushHistory(next, prev);
      draftRef.current = next;
      setDraftBody(body);
      schedulePropagate();
    },
    [pushHistory, schedulePropagate],
  );

  const undo = useCallback(() => {
    setPast((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1]!;
      const current = draftRef.current;
      setFuture((f) => [current, ...f]);
      skipHistory.current = true;
      draftRef.current = prev;
      setDraftTitle(prev.title);
      setDraftBody(prev.body);
      if (propagateTimer.current) {
        clearTimeout(propagateTimer.current);
        propagateTimer.current = null;
      }
      onChange(note.id, prev);
      return stack.slice(0, -1);
    });
  }, [note.id, onChange]);

  const redo = useCallback(() => {
    setFuture((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[0]!;
      const current = draftRef.current;
      setPast((p) => [...p, current]);
      skipHistory.current = true;
      draftRef.current = next;
      setDraftTitle(next.title);
      setDraftBody(next.body);
      if (propagateTimer.current) {
        clearTimeout(propagateTimer.current);
        propagateTimer.current = null;
      }
      onChange(note.id, next);
      return stack.slice(1);
    });
  }, [note.id, onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showPalette || showMore || showDate) {
          setShowPalette(false);
          setShowMore(false);
          setShowDate(false);
          return;
        }
        flushDraftToParent();
        onClose();
        return;
      }

      // Atalhos só com modificador — nunca interferir em digitação normal (espaço, letras…).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (!isTypingTarget(e.target) && !isTypingTarget(document.activeElement)) return;
        e.preventDefault();
        undo();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))
      ) {
        if (!isTypingTarget(e.target) && !isTypingTarget(document.activeElement)) return;
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flushDraftToParent, onClose, redo, showDate, showMore, showPalette, undo]);

  const handleClose = useCallback(() => {
    flushDraftToParent();
    onClose();
  }, [flushDraftToParent, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 sm:items-center sm:bg-black/55 sm:p-6 md:p-8">
      {/* div (não button): Espaço não “clica” no overlay e fecha o editor */}
      <div
        aria-hidden
        className="absolute inset-0 cursor-default max-sm:hidden"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex w-full flex-col overflow-hidden border shadow-[0_8px_28px_rgba(0,0,0,0.55)]",
          // Mobile: tela cheia estilo app; desktop: card centralizado
          "h-dvh max-h-dvh rounded-none border-transparent",
          "sm:h-[min(88vh,860px)] sm:max-h-[860px] sm:max-w-[920px] sm:rounded-xl sm:border",
          colors.card,
          colors.border,
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2 px-3 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:pt-5">
          <input
            ref={titleRef}
            value={draftTitle}
            onChange={(e) => commitTitle(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Título"
            className="min-w-0 flex-1 bg-transparent text-[20px] font-normal leading-tight tracking-tight text-[#e8eaed] placeholder:text-[#e8eaed]/40 focus:outline-none sm:text-[22px]"
          />
          <ToolbarButton
            title={note.pinned ? "Desafixar" : "Fixar"}
            onClick={() => onTogglePin(note.id)}
          >
            <Pin className={cn("h-[18px] w-[18px]", note.pinned && "fill-current text-[#e8eaed]")} />
          </ToolbarButton>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-4 pb-2 pt-1 sm:px-7 sm:pb-3 sm:pt-2">
          <textarea
            ref={bodyRef}
            value={draftBody}
            onChange={(e) => commitBody(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
            placeholder="Anotar..."
            className="h-full w-full resize-none overflow-y-auto bg-transparent text-[16px] leading-[1.6] text-[#e8eaed]/92 placeholder:text-[#e8eaed]/35 focus:outline-none [scrollbar-width:thin] [scrollbar-color:#5f6368_transparent]"
          />
        </div>

        {/* Barra inferior: ferramentas + undo/redo sempre visíveis no mobile */}
        <div
          className={cn(
            "relative shrink-0 border-t border-white/5",
            "pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 sm:pb-2 sm:pt-1",
          )}
        >
          {showPalette && (
            <div className="absolute bottom-[calc(100%+0.35rem)] left-2 right-2 z-20 flex flex-wrap gap-2 rounded-xl border border-[#5f6368]/50 bg-[#2d2e30] p-2.5 shadow-xl sm:right-auto sm:max-w-[320px]">
              {STICKY_NOTE_COLORS.map((color) => {
                const style = STICKY_NOTE_COLOR_STYLES[color];
                return (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSetColor(note.id, color);
                      setShowPalette(false);
                    }}
                    className={cn(
                      "relative h-9 w-9 rounded-full sm:h-7 sm:w-7",
                      style.swatch,
                      note.color === color && "ring-2 ring-[#e8eaed] ring-offset-1 ring-offset-[#2d2e30]",
                    )}
                  >
                    {note.color === color && (
                      <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-[#e8eaed]" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {showDate && (
            <div className="absolute bottom-[calc(100%+0.35rem)] left-2 right-2 z-20 rounded-xl border border-[#5f6368]/50 bg-[#2d2e30] p-3 shadow-xl sm:left-12 sm:right-auto sm:w-[260px]">
              <p className="mb-2 text-xs font-semibold text-[#e8eaed]/55">Data da nota</p>
              <input
                ref={dateInputRef}
                type="date"
                value={note.noteDate ?? ""}
                onChange={(e) => {
                  const value = e.target.value || null;
                  onChange(note.id, { noteDate: value });
                }}
                className="w-full rounded-lg border border-[#5f6368]/50 bg-[#202124] px-2 py-2.5 text-sm text-[#e8eaed] focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(note.id, { noteDate: format(new Date(), "yyyy-MM-dd") });
                  }}
                  className="rounded-md px-2.5 py-1.5 text-xs text-[#e8eaed]/80 hover:bg-white/10"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(note.id, { noteDate: null });
                  }}
                  className="rounded-md px-2.5 py-1.5 text-xs text-[#e8eaed]/80 hover:bg-white/10"
                >
                  Sem data
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowDate(false)}
                  className="ml-auto rounded-md px-2.5 py-1.5 text-xs font-medium text-brand-yellow hover:bg-brand-yellow/10"
                >
                  Salvar
                </button>
              </div>
              <p className="mt-2 text-[11px] text-[#e8eaed]/40">
                Atual: {formatNoteDateLabel(note.noteDate)}
              </p>
            </div>
          )}

          {showMore && (
            <div className="absolute bottom-[calc(100%+0.35rem)] left-2 z-20 min-w-[180px] overflow-hidden rounded-lg border border-[#5f6368]/50 bg-[#2d2e30] py-1 shadow-xl sm:left-auto">
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#e8eaed]/40 sm:hidden"
              >
                <UserPlus className="h-4 w-4" />
                Colaboradores
                <span className="ml-auto text-[10px]">em breve</span>
              </button>
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#e8eaed]/40 sm:hidden"
              >
                <ImagePlus className="h-4 w-4" />
                Imagem
                <span className="ml-auto text-[10px]">em breve</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#e8eaed]/90 hover:bg-white/10"
                onClick={() => {
                  flushDraftToParent();
                  onDelete(note.id);
                  onClose();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Excluir nota
              </button>
            </div>
          )}

          <div className="flex items-center gap-0.5 px-1.5 sm:px-3">
            {/* Ferramentas: scroll horizontal no mobile se precisar */}
            <div className="flex min-w-0 flex-1 items-center gap-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ToolbarButton
                title="Cor de fundo"
                onClick={() => {
                  setShowMore(false);
                  setShowDate(false);
                  setShowPalette((v) => !v);
                }}
              >
                <Palette className="h-[18px] w-[18px]" />
              </ToolbarButton>
              <ToolbarButton
                title="Data da nota"
                onClick={() => {
                  setShowMore(false);
                  setShowPalette(false);
                  setShowDate((v) => !v);
                }}
              >
                <CalendarDays className="h-[18px] w-[18px]" />
              </ToolbarButton>
              <span className="hidden sm:inline-flex">
                <ToolbarButton title="Colaboradores (em breve)" disabled>
                  <UserPlus className="h-[18px] w-[18px]" />
                </ToolbarButton>
                <ToolbarButton title="Imagem (em breve)" disabled>
                  <ImagePlus className="h-[18px] w-[18px]" />
                </ToolbarButton>
              </span>
              <ToolbarButton
                title="Arquivar"
                onClick={() => {
                  flushDraftToParent();
                  onArchive(note.id);
                  onClose();
                }}
              >
                <Archive className="h-[18px] w-[18px]" />
              </ToolbarButton>
              <ToolbarButton
                title="Mais"
                onClick={() => {
                  setShowPalette(false);
                  setShowDate(false);
                  setShowMore((v) => !v);
                }}
              >
                <MoreVertical className="h-[18px] w-[18px]" />
              </ToolbarButton>
            </div>

            <div className="mx-0.5 h-5 w-px shrink-0 bg-white/10 sm:mx-1" />

            {/* Undo / Redo — sempre fixos e tocáveis */}
            <ToolbarButton title="Desfazer" disabled={past.length === 0} onClick={undo}>
              <Undo2 className="h-[18px] w-[18px]" />
            </ToolbarButton>
            <ToolbarButton title="Refazer" disabled={future.length === 0} onClick={redo}>
              <Redo2 className="h-[18px] w-[18px]" />
            </ToolbarButton>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClose}
              className="ml-0.5 shrink-0 rounded-md px-3 py-2.5 text-sm font-medium text-[#e8eaed]/90 hover:bg-white/10 active:bg-white/15 sm:ml-1 sm:py-1.5"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
