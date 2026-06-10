
ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS edicoes_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_edicao_em timestamptz,
  ADD COLUMN IF NOT EXISTS editado boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.avaliacoes_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.avaliacoes(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.avaliacoes_versoes TO authenticated;
GRANT ALL ON public.avaliacoes_versoes TO service_role;

ALTER TABLE public.avaliacoes_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own avaliacao versions"
  ON public.avaliacoes_versoes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.avaliacoes a
    WHERE a.id = avaliacoes_versoes.avaliacao_id
      AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert versions of their own avaliacoes"
  ON public.avaliacoes_versoes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.avaliacoes a
    WHERE a.id = avaliacoes_versoes.avaliacao_id
      AND a.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_avaliacoes_versoes_avaliacao_id
  ON public.avaliacoes_versoes(avaliacao_id);
