DROP POLICY IF EXISTS "Users can insert their own cobrancas" ON public.cobrancas_avulsas;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.cobrancas_avulsas FROM authenticated;

REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.profiles TO authenticated;
GRANT UPDATE (
  nome,
  creci,
  cidade,
  estado,
  telefone,
  logo_url,
  cpf,
  tipo,
  nome_imobiliaria,
  cnai,
  outro_registro
) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (
    NEW.plano IS DISTINCT FROM OLD.plano OR
    NEW.creditos_avulsos IS DISTINCT FROM OLD.creditos_avulsos OR
    NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id OR
    NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id OR
    NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR
    NEW.plan_price_id IS DISTINCT FROM OLD.plan_price_id OR
    NEW.subscription_current_period_end IS DISTINCT FROM OLD.subscription_current_period_end
  ) AND (SELECT current_setting('app.bypass_rls', true) <> 'on') THEN
    RAISE EXCEPTION 'Campos de plano e cobrança não podem ser alterados diretamente pelo usuário. Use o painel administrativo ou o webhook do Stripe.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_billing_columns_trigger ON public.profiles;
CREATE TRIGGER protect_billing_columns_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_billing_columns();
