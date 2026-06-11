
-- 1) Profiles: restrict UPDATE column-level privileges for authenticated role
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (nome, creci, cidade, estado, telefone, logo_url, cpf, tipo, nome_imobiliaria, cnai, outro_registro)
  ON public.profiles TO authenticated;

-- 2) Make RLS policies explicit to 'authenticated' role
DROP POLICY IF EXISTS "Users can manage their own comparables" ON public.comparaveis;
CREATE POLICY "Users can manage their own comparables" ON public.comparaveis
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.avaliacoes WHERE avaliacoes.id = comparaveis.avaliacao_id AND avaliacoes.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.avaliacoes WHERE avaliacoes.id = comparaveis.avaliacao_id AND avaliacoes.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their own results" ON public.resultados;
CREATE POLICY "Users can manage their own results" ON public.resultados
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.avaliacoes WHERE avaliacoes.id = resultados.avaliacao_id AND avaliacoes.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.avaliacoes WHERE avaliacoes.id = resultados.avaliacao_id AND avaliacoes.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their own avaliacao versions" ON public.avaliacoes_versoes;
CREATE POLICY "Users can view their own avaliacao versions" ON public.avaliacoes_versoes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.avaliacoes a WHERE a.id = avaliacoes_versoes.avaliacao_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert versions of their own avaliacoes" ON public.avaliacoes_versoes;
CREATE POLICY "Users can insert versions of their own avaliacoes" ON public.avaliacoes_versoes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.avaliacoes a WHERE a.id = avaliacoes_versoes.avaliacao_id AND a.user_id = auth.uid()));
