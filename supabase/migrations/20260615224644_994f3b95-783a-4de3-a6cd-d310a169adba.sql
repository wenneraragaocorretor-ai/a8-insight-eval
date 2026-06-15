-- Remove default 'basico' da coluna plano
ALTER TABLE public.profiles ALTER COLUMN plano DROP DEFAULT;

-- Trigger não atribui mais plano automaticamente; usuário fica sem plano até pagar
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_name text;
BEGIN
  user_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'nome', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    NULLIF(split_part(NEW.email, '@', 1), ''),
    'Usuário'
  );

  -- plano = NULL: acesso só liberado após pagamento confirmado pelo webhook do Stripe
  INSERT INTO public.profiles (id, nome, plano, created_at)
  VALUES (NEW.id, user_name, NULL, now())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;