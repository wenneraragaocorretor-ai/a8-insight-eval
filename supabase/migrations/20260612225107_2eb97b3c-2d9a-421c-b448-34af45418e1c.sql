CREATE OR REPLACE FUNCTION public.protect_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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
      NEW.subscription_current_period_end IS DISTINCT FROM OLD.subscription_current_period_end
    ) THEN
      RAISE EXCEPTION 'Campos de plano e cobrança não podem ser alterados diretamente pelo usuário. Use o painel administrativo ou o webhook do Stripe.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
