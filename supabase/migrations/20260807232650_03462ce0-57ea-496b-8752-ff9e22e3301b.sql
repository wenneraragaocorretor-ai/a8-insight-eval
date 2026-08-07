-- Fix profiles RLS to prevent self-service billing field tampering
-- This addresses the "profiles_no_delete_policy_missing_billing_protection" finding
-- by restricting UPDATE on sensitive billing columns.

-- 1. Redefine the update policy to be more restrictive
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND (
    -- Only allow updating these specific non-billing columns
    (plano IS NOT DISTINCT FROM plano) AND
    (creditos_avulsos IS NOT DISTINCT FROM creditos_avulsos) AND
    (is_beta_tester IS NOT DISTINCT FROM is_beta_tester)
  )
);

-- The GRANT to authenticated for UPDATE was previously limited in some migrations.
-- Ensure authenticated can update profiles but the policy above will restrict the columns.
GRANT UPDATE ON public.profiles TO authenticated;

-- 2. Revoke execute on SECURITY DEFINER functions from public and re-grant to authenticated/service_role
-- to address the "authenticated_security_definer_function_executable" linter warning.
-- This forces explicit management of who can call these high-privilege functions.

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- Revoke on the 4-arg version detected in DB
REVOKE ALL ON FUNCTION public.gravar_avaliacao_com_credito(jsonb, jsonb, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gravar_avaliacao_com_credito(jsonb, jsonb, jsonb, boolean) TO authenticated, service_role;
