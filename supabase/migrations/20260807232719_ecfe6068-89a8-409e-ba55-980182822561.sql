-- Revoking PUBLIC access to all SECURITY DEFINER functions in public schema
-- to satisfy the linter's authenticated_security_definer_function_executable warning.
-- This ensures only the service_role and authenticated users can call them.

REVOKE ALL ON FUNCTION public.gravar_avaliacao_com_credito(jsonb, jsonb, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gravar_avaliacao_com_credito(jsonb, jsonb, jsonb, boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user_profile() TO service_role; -- profile creation is triggered by auth events, usually runs as service_role/postgres

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.resolver_codigo_afiliado(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolver_codigo_afiliado(text) TO authenticated, service_role;
