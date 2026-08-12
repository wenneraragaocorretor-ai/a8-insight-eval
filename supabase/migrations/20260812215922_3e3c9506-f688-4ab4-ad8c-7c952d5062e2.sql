-- 1. Apply the existing migration logic exactly (Idempotency and Security Fix)
ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS idempotency_key uuid UNIQUE;

CREATE OR REPLACE FUNCTION public.protect_billing_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF CURRENT_USER IN ('authenticated', 'anon') AND 
     current_setting('app.authorized_billing_update', true) IS DISTINCT FROM 'true' THEN
    IF (NEW.plano IS DISTINCT FROM OLD.plano OR
        NEW.creditos_avulsos IS DISTINCT FROM OLD.creditos_avulsos OR
        NEW.is_beta_tester IS DISTINCT FROM OLD.is_beta_tester) THEN
      RAISE EXCEPTION 'Unauthorized billing update attempt.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Note: The full function body below is required because the previous partial apply failed schema validation.
CREATE OR REPLACE FUNCTION public.gravar_avaliacao_com_credito(
  p_avaliacao_data jsonb, p_comparaveis_data jsonb, p_resultado_data jsonb, 
  p_consome_credito boolean, p_idempotency_key uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_avaliacao_id uuid;
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.avaliacoes 
    WHERE idempotency_key = p_idempotency_key AND user_id = v_user_id;
    IF v_existing_id IS NOT NULL THEN RETURN v_existing_id; END IF;
  END IF;

  PERFORM set_config('app.authorized_billing_update', 'true', true);

  IF p_consome_credito THEN
    IF (SELECT creditos_avulsos FROM public.profiles WHERE id = v_user_id FOR UPDATE) < 1 THEN
      RAISE EXCEPTION 'Insufficient credits';
    END IF;
    UPDATE public.profiles SET creditos_avulsos = creditos_avulsos - 1 WHERE id = v_user_id;
  END IF;

  INSERT INTO public.avaliacoes (
    user_id, titulo, tipo_imovel, endereco, area_privativa, area_total, 
    quartos, banheiros, vagas, idempotency_key, resultado_ia, analise_mercado
  ) VALUES (
    v_user_id,
    p_avaliacao_data->>'titulo',
    p_avaliacao_data->>'tipo_imovel',
    p_avaliacao_data->>'endereco',
    (p_avaliacao_data->>'area_privativa')::numeric,
    (p_avaliacao_data->>'area_total')::numeric,
    (p_avaliacao_data->>'quartos')::integer,
    (p_avaliacao_data->>'banheiros')::integer,
    (p_avaliacao_data->>'vagas')::integer,
    p_idempotency_key,
    p_resultado_data,
    p_resultado_data->'analise_mercado'
  ) RETURNING id INTO v_avaliacao_id;

  INSERT INTO public.comparaveis (avaliacao_id, user_id, dados)
  SELECT v_avaliacao_id, v_user_id, value
  FROM jsonb_array_elements(p_comparaveis_data);

  RETURN v_avaliacao_id;
END;
$$;

-- 2. Grant permissions specifically to the correct signature
GRANT EXECUTE ON FUNCTION public.gravar_avaliacao_com_credito(
  jsonb, jsonb, jsonb, boolean, uuid
) TO authenticated;

-- 3. Reload PostgREST cache
NOTIFY pgrst, 'reload schema';
