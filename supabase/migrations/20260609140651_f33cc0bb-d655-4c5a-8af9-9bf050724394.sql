CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name text;
BEGIN
  user_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'nome', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    NULLIF(split_part(NEW.email, '@', 1), ''),
    'Usuário'
  );

  INSERT INTO public.profiles (id, nome, plano, created_at)
  VALUES (NEW.id, user_name, 'basico'::public.user_role, now())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

ALTER TABLE public.profiles ALTER COLUMN plano SET DEFAULT 'basico'::public.user_role;

GRANT EXECUTE ON FUNCTION public.handle_new_user_profile() TO service_role;