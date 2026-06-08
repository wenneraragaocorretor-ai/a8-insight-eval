
ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS posicao text;

ALTER TABLE public.comparaveis
  ADD COLUMN IF NOT EXISTS area_privativa numeric,
  ADD COLUMN IF NOT EXISTS suites integer,
  ADD COLUMN IF NOT EXISTS banheiros integer,
  ADD COLUMN IF NOT EXISTS posicao text,
  ADD COLUMN IF NOT EXISTS andar integer,
  ADD COLUMN IF NOT EXISTS idade integer,
  ADD COLUMN IF NOT EXISTS condominio numeric,
  ADD COLUMN IF NOT EXISTS caracteristicas jsonb DEFAULT '[]'::jsonb;
