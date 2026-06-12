
-- 1) Add user_id to resultados
ALTER TABLE public.resultados ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.resultados r
SET user_id = a.user_id
FROM public.avaliacoes a
WHERE r.avaliacao_id = a.id AND r.user_id IS NULL;

ALTER TABLE public.resultados ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.resultados
  ADD CONSTRAINT resultados_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS resultados_user_id_idx ON public.resultados(user_id);

-- 2) RLS resultados: filter directly by user_id
DROP POLICY IF EXISTS "Users can manage their own results" ON public.resultados;
CREATE POLICY "Users can manage their own results"
ON public.resultados
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3) avaliacoes policy: restrict to authenticated role
DROP POLICY IF EXISTS "Users can manage their own evaluations" ON public.avaliacoes;
CREATE POLICY "Users can manage their own evaluations"
ON public.avaliacoes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4) Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
