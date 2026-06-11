CREATE TABLE public.cobrancas_avulsas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  valor_cents INTEGER NOT NULL,
  moeda TEXT NOT NULL DEFAULT 'brl',
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  status TEXT NOT NULL DEFAULT 'paid',
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cobrancas_avulsas TO authenticated;
GRANT ALL ON public.cobrancas_avulsas TO service_role;

ALTER TABLE public.cobrancas_avulsas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cobrancas"
ON public.cobrancas_avulsas
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX cobrancas_avulsas_user_id_created_at_idx
ON public.cobrancas_avulsas (user_id, created_at DESC);

CREATE UNIQUE INDEX cobrancas_avulsas_stripe_session_id_uidx
ON public.cobrancas_avulsas (stripe_session_id)
WHERE stripe_session_id IS NOT NULL;