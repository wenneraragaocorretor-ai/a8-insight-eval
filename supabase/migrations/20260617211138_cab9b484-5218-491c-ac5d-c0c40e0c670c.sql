
-- 1) Add 'afiliado' to app_role enum (idempotent-ish)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'afiliado'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'afiliado';
  END IF;
END$$;

-- 2) afiliados table
CREATE TABLE IF NOT EXISTS public.afiliados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  codigo text NOT NULL UNIQUE,
  percentual_comissao numeric(5,2) NOT NULL DEFAULT 20.00 CHECK (percentual_comissao >= 0 AND percentual_comissao <= 100),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.afiliados TO authenticated;
GRANT ALL ON public.afiliados TO service_role;

ALTER TABLE public.afiliados ENABLE ROW LEVEL SECURITY;

-- Affiliate sees own row
CREATE POLICY "Affiliate reads own row"
  ON public.afiliados FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admin full access
CREATE POLICY "Admins manage afiliados"
  ON public.afiliados FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER afiliados_set_updated_at
  BEFORE UPDATE ON public.afiliados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_afiliados_codigo_ativo ON public.afiliados (codigo) WHERE ativo;

-- 3) indicacoes_afiliado table
CREATE TABLE IF NOT EXISTS public.indicacoes_afiliado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id uuid NOT NULL REFERENCES public.afiliados(id) ON DELETE CASCADE,
  usuario_indicado_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano text NOT NULL,
  valor_pago numeric(12,2) NOT NULL,
  valor_comissao numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago')),
  stripe_session_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  pago_em timestamptz,
  CONSTRAINT indicacoes_afiliado_usuario_unico UNIQUE (usuario_indicado_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.indicacoes_afiliado TO authenticated;
GRANT ALL ON public.indicacoes_afiliado TO service_role;

ALTER TABLE public.indicacoes_afiliado ENABLE ROW LEVEL SECURITY;

-- Affiliate reads own indications
CREATE POLICY "Affiliate reads own indicacoes"
  ON public.indicacoes_afiliado FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.afiliados a
      WHERE a.id = indicacoes_afiliado.afiliado_id AND a.user_id = auth.uid()
    )
  );

-- Admin full access
CREATE POLICY "Admins manage indicacoes"
  ON public.indicacoes_afiliado FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_indicacoes_afiliado_afiliado ON public.indicacoes_afiliado (afiliado_id);
CREATE INDEX IF NOT EXISTS idx_indicacoes_afiliado_status ON public.indicacoes_afiliado (status);

-- 4) profiles.afiliado_indicador_id (which affiliate referred this user)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS afiliado_indicador_id uuid REFERENCES public.afiliados(id) ON DELETE SET NULL;

-- Lock field after first non-null set (user/anon roles only); admin/service_role/webhook bypass
CREATE OR REPLACE FUNCTION public.lock_afiliado_indicador()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF CURRENT_USER IN ('authenticated','anon') THEN
    IF OLD.afiliado_indicador_id IS NOT NULL
       AND NEW.afiliado_indicador_id IS DISTINCT FROM OLD.afiliado_indicador_id THEN
      RAISE EXCEPTION 'afiliado_indicador_id já foi definido e não pode ser alterado.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_lock_afiliado_indicador ON public.profiles;
CREATE TRIGGER profiles_lock_afiliado_indicador
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_afiliado_indicador();

-- 5) Helper function: resolve afiliado_id from referral code (used by client during signup)
-- SECURITY DEFINER so unauthenticated/just-signed-up users can map code -> id
-- without exposing the full afiliados table.
CREATE OR REPLACE FUNCTION public.resolver_codigo_afiliado(_codigo text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.afiliados
  WHERE codigo = upper(_codigo) AND ativo = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolver_codigo_afiliado(text) TO anon, authenticated;
