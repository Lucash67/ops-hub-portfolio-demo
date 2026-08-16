"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StickyNote } from "@/lib/sticky-notes/types";
import { STICKY_NOTE_COLOR_STYLES } from "@/lib/sticky-notes/types";
import {
  UNDATED_COLUMN_ID,
  buildDayColumnsForWeek,
  dateForWeekDrop,
  formatNoteDateLabel,
  mapNoteDateToWeek,
  parseWeekDropId,
  type WeekColumn,
} from "@/lib/sticky-notes/week-board";
import { WeekPicker } from "@/components/sticky-notes/week-picker";

interface NotesBoardProps {
  notes: StickyNote[];
  /** Segunda-feira da semana em foco (yyyy-MM-dd). */
  focusWeekStart: string;
  onFocusWeekChange: (weekStart: string) => void;
  onOpen: (note: StickyNote) => void;
  onBoardChange: (notes: StickyNote[]) => void;
  /** Cria nota já datada no dia da coluna (seg–sáb). */
  onCreateForDay?: (date: string) => void;
  /** Itens à esquerda do seletor de semana (ex.: busca), dentro do DndContext. */
  toolbarStart?: ReactNode;
  /** Itens à direita do seletor de semana (ex.: filtros). */
  toolbarEnd?: ReactNode;
  /** Conteúdo entre a barra de semana e as colunas (ex.: compose). */
  belowToolbar?: ReactNode;
}

/** Seg–sáb (domingo = 0 fica de fora). Parse local evita shift UTC. */
function isWeekdayColumn(dateKey: string): boolean {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return false;
  return new Date(y, m - 1, d).getDay() !== 0;
}

function SortableNoteCard({
  note,
  onOpen,
}: {
  note: StickyNote;
  onOpen: (note: StickyNote) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
    data: { type: "note", note },
  });
  const colors = STICKY_NOTE_COLOR_STYLES[note.color] ?? STICKY_NOTE_COLOR_STYLES.default;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group rounded-lg border shadow-sm",
        colors.card,
        colors.border,
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1 p-3 sm:p-2.5">
        <button
          type="button"
          aria-label="Arrastar nota"
          className="mt-0.5 flex h-9 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-[#e8eaed]/35 hover:bg-white/10 hover:text-[#e8eaed]/70 active:cursor-grabbing sm:h-auto sm:w-auto sm:p-0.5"
          {...attributes}
          {...listeners}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => onOpen(note)} className="min-w-0 flex-1 py-0.5 text-left">
          {note.title.trim() ? (
            <p className="truncate text-[15px] font-medium text-[#e8eaed] sm:text-sm">{note.title}</p>
          ) : null}
          <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap text-[14px] leading-snug text-[#e8eaed]/75 sm:text-[13px]">
            {note.body.trim() || "Nota vazia"}
          </p>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-[#e8eaed]/40">
            {formatNoteDateLabel(note.noteDate)}
          </p>
        </button>
      </div>
    </div>
  );
}

function WeekLane({
  column,
  onOpen,
  onCreateForDay,
}: {
  column: WeekColumn;
  onOpen: (note: StickyNote) => void;
  onCreateForDay?: (date: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col:${column.id}`,
    data: { type: "column", columnId: column.id },
  });
  const canCreate =
    Boolean(onCreateForDay) &&
    column.id !== UNDATED_COLUMN_ID &&
    isWeekdayColumn(column.id);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex h-full w-[min(78vw,240px)] shrink-0 snap-start flex-col rounded-xl border bg-[#18191b]/90 sm:w-[220px]",
        isOver ? "border-brand-yellow/50 bg-[#202124]" : "border-[#5f6368]/30",
      )}
    >
      <header className="border-b border-[#5f6368]/25 px-3 py-3">
        <p className="text-[15px] font-semibold capitalize leading-tight tracking-tight text-white sm:text-[17px]">
          {column.label}
        </p>
        <p className="mt-1 text-[11px] text-[#e8eaed]/45">
          {column.notes.length} {column.notes.length === 1 ? "nota" : "notas"}
        </p>
        {canCreate ? (
          <button
            type="button"
            onClick={() => onCreateForDay?.(column.id)}
            className="mt-2.5 inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-lg border border-[#5f6368]/40 bg-[#202124]/80 px-2 py-2 text-[12px] font-medium text-[#e8eaed]/80 transition hover:border-brand-yellow/40 hover:bg-[#28292c] hover:text-[#e8eaed] active:bg-[#303134]"
          >
            <Plus className="h-4 w-4" />
            Criar nota
          </button>
        ) : null}
      </header>
      <SortableContext items={column.notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[200px] flex-1 flex-col gap-2 overflow-y-auto p-2 [scrollbar-width:thin] sm:min-h-[160px]">
          {column.notes.map((note) => (
            <SortableNoteCard key={note.id} note={note} onOpen={onOpen} />
          ))}
          {column.notes.length === 0 && (
            <p className="px-2 py-8 text-center text-xs text-[#e8eaed]/30">
              Arraste notas para cá
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function findColumnOfNote(columns: WeekColumn[], noteId: string): WeekColumn | null {
  return columns.find((c) => c.notes.some((n) => n.id === noteId)) ?? null;
}

function resolveTargetColumn(
  columns: WeekColumn[],
  overId: string,
): WeekColumn | null {
  if (overId.startsWith("col:")) {
    const id = overId.slice(4);
    return columns.find((c) => c.id === id) ?? null;
  }
  return findColumnOfNote(columns, overId);
}

function appendToDay(notes: StickyNote[], noteId: string, nextDate: string): StickyNote[] {
  const peers = notes.filter((n) => n.id !== noteId && n.noteDate === nextDate);
  const maxOrder = peers.reduce((m, n) => Math.max(m, n.sortOrder), -1);
  return notes.map((n) =>
    n.id === noteId ? { ...n, noteDate: nextDate, sortOrder: maxOrder + 1 } : n,
  );
}

export function NotesBoard({
  notes,
  focusWeekStart,
  onFocusWeekChange,
  onOpen,
  onBoardChange,
  onCreateForDay,
  toolbarStart,
  toolbarEnd,
  belowToolbar,
}: NotesBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const columns = useMemo(
    () => buildDayColumnsForWeek(notes, focusWeekStart),
    [notes, focusWeekStart],
  );

  const activeNote = activeId ? notes.find((n) => n.id === activeId) ?? null : null;
  const weekDropActive = Boolean(activeId);

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const noteId = String(active.id);
    const overId = String(over.id);
    const moving = notes.find((n) => n.id === noteId);
    if (!moving) return;

    const weekTarget = parseWeekDropId(overId);
    if (weekTarget) {
      const nextDate = mapNoteDateToWeek(moving.noteDate, weekTarget);
      onBoardChange(appendToDay(notes, noteId, nextDate));
      onFocusWeekChange(weekTarget);
      return;
    }

    const fromCol = findColumnOfNote(columns, noteId);
    const toCol = resolveTargetColumn(columns, overId);
    if (!fromCol || !toCol) return;

    const nextDate =
      toCol.id === UNDATED_COLUMN_ID
        ? null
        : dateForWeekDrop(toCol.weekStart, moving.noteDate);

    let targetIds = toCol.notes.map((n) => n.id).filter((id) => id !== noteId);
    if (fromCol.id === toCol.id) {
      const oldIndex = toCol.notes.findIndex((n) => n.id === noteId);
      let newIndex = toCol.notes.findIndex((n) => n.id === overId);
      if (overId.startsWith("col:")) newIndex = toCol.notes.length - 1;
      if (oldIndex < 0) return;
      if (newIndex < 0) newIndex = toCol.notes.length - 1;
      const reordered = arrayMove(
        toCol.notes.map((n) => n.id),
        oldIndex,
        newIndex,
      );
      targetIds = reordered;
    } else {
      let insertAt = toCol.notes.findIndex((n) => n.id === overId);
      if (insertAt < 0 || overId.startsWith("col:")) insertAt = targetIds.length;
      targetIds.splice(insertAt, 0, noteId);
    }

    const orderMap = new Map(targetIds.map((id, index) => [id, index]));
    const next = notes.map((n) => {
      if (n.id === noteId) {
        return {
          ...n,
          noteDate: nextDate,
          sortOrder: orderMap.get(n.id) ?? 0,
        };
      }
      if (orderMap.has(n.id)) {
        return { ...n, sortOrder: orderMap.get(n.id)! };
      }
      return n;
    });

    onBoardChange(next);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="mb-4 flex flex-col gap-2.5 sm:mb-5 sm:gap-3 lg:flex-row lg:items-center">
        {toolbarStart}
        <div className="flex items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <WeekPicker
            weekStart={focusWeekStart}
            onChange={onFocusWeekChange}
            weekDropActive={weekDropActive}
            className="min-w-0 flex-1 sm:flex-none"
          />
          {toolbarEnd}
        </div>
      </div>

      {belowToolbar ? <div className="mb-4 sm:mb-5">{belowToolbar}</div> : null}

      {weekDropActive ? (
        <p className="mb-3 text-xs text-brand-yellow/80">
          Solte nas setas ← → da semana para mover a nota (mantém o mesmo dia da semana).
        </p>
      ) : null}

      <div className="-mx-1 flex min-h-[min(60vh,480px)] snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-4 [scrollbar-width:thin] sm:mx-0 sm:min-h-[420px] sm:gap-3 sm:px-0 sm:pb-3">
        {columns.map((column) => (
          <WeekLane
            key={column.id}
            column={column}
            onOpen={onOpen}
            onCreateForDay={onCreateForDay}
          />
        ))}
      </div>

      <DragOverlay>
        {activeNote ? (
          <div
            className={cn(
              "w-[252px] rounded-lg border p-3 shadow-2xl",
              STICKY_NOTE_COLOR_STYLES[activeNote.color]?.card,
              STICKY_NOTE_COLOR_STYLES[activeNote.color]?.border,
            )}
          >
            <p className="text-sm font-medium text-[#e8eaed]">
              {activeNote.title.trim() || "Nota"}
            </p>
            <p className="mt-1 line-clamp-3 text-xs text-[#e8eaed]/70">{activeNote.body}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
