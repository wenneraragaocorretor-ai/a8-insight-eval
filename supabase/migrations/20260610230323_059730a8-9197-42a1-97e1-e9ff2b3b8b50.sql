
-- Profiles: split ALL policy and restrict sensitive columns
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Revoke direct UPDATE on billing/plan columns; only service_role may change them
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  nome, telefone, estado, cidade, creci, outro_registro, cnai,
  nome_imobiliaria, tipo, cpf, email, logo_url, updated_at
) ON public.profiles TO authenticated;

-- avaliacoes_versoes: explicit restrictive deny for UPDATE and DELETE
CREATE POLICY "Version snapshots are immutable"
  ON public.avaliacoes_versoes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Version snapshots cannot be deleted"
  ON public.avaliacoes_versoes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (false);
