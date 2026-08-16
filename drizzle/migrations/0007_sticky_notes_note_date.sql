-- Data de referência da nota (organização por semana no board).

ALTER TABLE public.sticky_notes
  ADD COLUMN IF NOT EXISTS note_date DATE;

CREATE INDEX IF NOT EXISTS idx_sticky_notes_owner_note_date
  ON public.sticky_notes (owner_id, note_date);
