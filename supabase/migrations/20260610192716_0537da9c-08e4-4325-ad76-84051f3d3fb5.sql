ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS fotos_meta jsonb DEFAULT '[]'::jsonb;