import { z } from "zod";

export const STICKY_NOTE_COLORS = [
  "default",
  "coral",
  "peach",
  "sand",
  "mint",
  "fog",
  "dusk",
  "lilac",
  "rose",
  "slate",
] as const;

export type StickyNoteColor = (typeof STICKY_NOTE_COLORS)[number];

export const stickyNoteSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid().optional(),
  businessId: z.string().nullable().optional(),
  title: z.string().max(500).default(""),
  body: z.string().max(100_000).default(""),
  color: z.enum(STICKY_NOTE_COLORS).default("default"),
  /** Data de referência da nota (yyyy-MM-dd). Null = Sem data. */
  noteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  pinned: z.boolean().default(false),
  archived: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  clientUpdatedAt: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type StickyNote = z.infer<typeof stickyNoteSchema>;

export const stickyNoteUpsertSchema = stickyNoteSchema.partial().extend({
  id: z.string().uuid().optional(),
  title: z.string().max(500).optional(),
  body: z.string().max(100_000).optional(),
  color: z.enum(STICKY_NOTE_COLORS).optional(),
  noteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  clientUpdatedAt: z.string().min(1),
});

export type StickyNoteUpsert = z.infer<typeof stickyNoteUpsertSchema>;

/** Paleta escura próxima do Google Keep. */
export const STICKY_NOTE_COLOR_STYLES: Record<
  StickyNoteColor,
  { card: string; border: string; swatch: string }
> = {
  default: {
    card: "bg-[#202124]",
    border: "border-[#5f6368]/40",
    swatch: "bg-[#202124] ring-1 ring-[#5f6368]",
  },
  coral: {
    card: "bg-[#5c2b29]",
    border: "border-[#5c2b29]",
    swatch: "bg-[#5c2b29]",
  },
  peach: {
    card: "bg-[#614a19]",
    border: "border-[#614a19]",
    swatch: "bg-[#614a19]",
  },
  sand: {
    card: "bg-[#635d19]",
    border: "border-[#635d19]",
    swatch: "bg-[#635d19]",
  },
  mint: {
    card: "bg-[#345920]",
    border: "border-[#345920]",
    swatch: "bg-[#345920]",
  },
  fog: {
    card: "bg-[#16504b]",
    border: "border-[#16504b]",
    swatch: "bg-[#16504b]",
  },
  dusk: {
    card: "bg-[#2d555e]",
    border: "border-[#2d555e]",
    swatch: "bg-[#2d555e]",
  },
  lilac: {
    card: "bg-[#42275e]",
    border: "border-[#42275e]",
    swatch: "bg-[#42275e]",
  },
  rose: {
    card: "bg-[#5b2245]",
    border: "border-[#5b2245]",
    swatch: "bg-[#5b2245]",
  },
  slate: {
    card: "bg-[#3c3f43]",
    border: "border-[#3c3f43]",
    swatch: "bg-[#3c3f43]",
  },
};
