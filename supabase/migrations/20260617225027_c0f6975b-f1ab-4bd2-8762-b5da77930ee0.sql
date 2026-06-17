-- Defense-in-depth: revoke UPDATE privilege on billing/subscription columns
-- from the authenticated and anon roles at the column-grant level. This is
-- evaluated BEFORE RLS and complements the existing protect_billing_columns
-- trigger. RLS policies cannot compare OLD vs NEW values, so column-level
-- GRANTs are the canonical Postgres mechanism for "this column is read-only
-- to end users".

REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
REVOKE UPDATE ON TABLE public.profiles FROM anon;

-- Re-grant UPDATE only on user-editable columns. Any column NOT listed here
-- becomes read-only for the authenticated role (defense-in-depth on top of
-- the protect_billing_columns trigger, which stays in place).
GRANT UPDATE (
  nome,
  creci,
  cnai,
  outro_registro,
  cidade,
  estado,
  telefone,
  logo_url,
  email,
  cpf,
  tipo,
  nome_imobiliaria,
  afiliado_indicador_id
) ON public.profiles TO authenticated;

-- service_role keeps full access (Stripe webhook, admin panel).
GRANT ALL ON TABLE public.profiles TO service_role;