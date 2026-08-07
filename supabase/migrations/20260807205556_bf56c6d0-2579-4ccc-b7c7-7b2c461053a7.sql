-- Revogar execução pública para evitar abuso e satisfazer o linter
REVOKE EXECUTE ON FUNCTION public.gravar_avaliacao_com_credito(jsonb, jsonb, jsonb, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gravar_avaliacao_com_credito(jsonb, jsonb, jsonb, boolean) FROM anon;

-- Conceder execução apenas para usuários autenticados e service_role
GRANT EXECUTE ON FUNCTION public.gravar_avaliacao_com_credito(jsonb, jsonb, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gravar_avaliacao_com_credito(jsonb, jsonb, jsonb, boolean) TO service_role;
