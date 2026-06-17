
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_beta_tester boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beta_plano text,
  ADD COLUMN IF NOT EXISTS beta_expira_em timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_beta_plano_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_beta_plano_check
  CHECK (beta_plano IS NULL OR beta_plano IN ('basico','profissional','expert'));

-- Bloquear que usuários comuns alterem campos de beta diretamente
CREATE OR REPLACE FUNCTION public.protect_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF CURRENT_USER = 'authenticated' OR CURRENT_USER = 'anon' THEN
    IF (
      NEW.plano IS DISTINCT FROM OLD.plano OR
      NEW.creditos_avulsos IS DISTINCT FROM OLD.creditos_avulsos OR
      NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id OR
      NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id OR
      NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR
      NEW.plan_price_id IS DISTINCT FROM OLD.plan_price_id OR
      NEW.subscription_current_period_end IS DISTINCT FROM OLD.subscription_current_period_end OR
      NEW.is_beta_tester IS DISTINCT FROM OLD.is_beta_tester OR
      NEW.beta_plano IS DISTINCT FROM OLD.beta_plano OR
      NEW.beta_expira_em IS DISTINCT FROM OLD.beta_expira_em
    ) THEN
      RAISE EXCEPTION 'Campos de plano e cobrança não podem ser alterados diretamente pelo usuário. Use o painel administrativo ou o webhook do Stripe.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
