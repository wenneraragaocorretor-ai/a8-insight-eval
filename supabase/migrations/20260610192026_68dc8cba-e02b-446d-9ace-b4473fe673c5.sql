ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS ambientes_sociais jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ambientes_servico jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ambientes_outros jsonb DEFAULT '[]'::jsonb;