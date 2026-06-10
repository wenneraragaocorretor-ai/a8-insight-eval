ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS tipo_acabamento jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS numero_pavimentos text;