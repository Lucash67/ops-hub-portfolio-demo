-- Bloco de notas estilo Keep — notas pessoais do usuário (owner_id).

CREATE TABLE IF NOT EXISTS public.sticky_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses (id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'default',
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sticky_notes_owner
  ON public.sticky_notes (owner_id);

CREATE INDEX IF NOT EXISTS idx_sticky_notes_owner_archived
  ON public.sticky_notes (owner_id, archived);

CREATE INDEX IF NOT EXISTS idx_sticky_notes_owner_updated
  ON public.sticky_notes (owner_id, client_updated_at DESC);
