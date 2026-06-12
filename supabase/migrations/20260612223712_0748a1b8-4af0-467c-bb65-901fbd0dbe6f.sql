DROP POLICY IF EXISTS "Users can insert their own cobrancas" ON public.cobrancas_avulsas;
CREATE POLICY "Users can insert their own cobrancas"
ON public.cobrancas_avulsas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);