
ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS idade_real integer,
  ADD COLUMN IF NOT EXISTS idade_aparente text,
  ADD COLUMN IF NOT EXISTS posicao_solar text,
  ADD COLUMN IF NOT EXISTS topografia text,
  ADD COLUMN IF NOT EXISTS zoneamento text,
  ADD COLUMN IF NOT EXISTS infraestrutura_lazer jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS vagas_cobertas integer,
  ADD COLUMN IF NOT EXISTS vagas_descobertas integer,
  ADD COLUMN IF NOT EXISTS total_andares integer;
