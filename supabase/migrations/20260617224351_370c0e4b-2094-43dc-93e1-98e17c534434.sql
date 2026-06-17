-- Defense-in-depth: revoke write privileges on user_roles from authenticated/anon.
-- Only service_role (used by admin server functions) may modify roles.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.user_roles FROM authenticated;
REVOKE ALL ON TABLE public.user_roles FROM anon;

-- Ensure intended access remains intact.
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;

-- Add explicit restrictive policies as an additional safety layer in case
-- a future migration accidentally re-grants write privileges.
DROP POLICY IF EXISTS "Block role inserts from clients" ON public.user_roles;
CREATE POLICY "Block role inserts from clients"
  ON public.user_roles AS RESTRICTIVE
  FOR INSERT TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block role updates from clients" ON public.user_roles;
CREATE POLICY "Block role updates from clients"
  ON public.user_roles AS RESTRICTIVE
  FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Block role deletes from clients" ON public.user_roles;
CREATE POLICY "Block role deletes from clients"
  ON public.user_roles AS RESTRICTIVE
  FOR DELETE TO authenticated, anon
  USING (false);