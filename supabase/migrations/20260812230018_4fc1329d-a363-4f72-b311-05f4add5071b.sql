
CREATE OR REPLACE FUNCTION public.gravar_avaliacao_com_credito(
  p_avaliacao_data jsonb,
  p_comparaveis_data jsonb,
  p_resultado_data jsonb,
  p_consome_credito boolean,
  p_idempotency_key uuid DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    user_id, localizacao, tipo_imovel, endereco_completo, area_privativa, area_total, quartos, banheiros, vagas, idempotency_key, status, tipo_relatorio, finalidade, area_construida, suites, posicao, caracteristicas, observacoes, fotos, idade_real, idade_aparente, posicao_solar, topografia, zoneamento, infraestrutura_lazer, vagas_cobertas, vagas_descobertas, total_andares, tipo_acabamento, numero_pavimentos, ambientes_sociais, ambientes_servico, ambientes_outros, fotos_meta
  ) VALUES (
    v_user_id, p_avaliacao_data->>'localizacao', p_avaliacao_data->>'tipo_imovel', p_avaliacao_data->>'endereco_completo', (p_avaliacao_data->>'area_privativa')::numeric, (p_avaliacao_data->>'area_total')::numeric, (p_avaliacao_data->>'quartos')::integer, (p_avaliacao_data->>'banheiros')::integer, (p_avaliacao_data->>'vagas')::integer, p_idempotency_key, COALESCE(p_avaliacao_data->>'status', 'concluido'), p_avaliacao_data->>'tipo_relatorio', p_avaliacao_data->>'finalidade', (p_avaliacao_data->>'area_construida')::numeric, (p_avaliacao_data->>'suites')::integer, p_avaliacao_data->>'posicao', COALESCE(p_avaliacao_data->'caracteristicas', '[]'::jsonb), p_avaliacao_data->>'observacoes', COALESCE(p_avaliacao_data->'fotos', '[]'::jsonb), (p_avaliacao_data->>'idade_real')::integer, p_avaliacao_data->>'idade_aparente', p_avaliacao_data->>'posicao_solar', p_avaliacao_data->>'topografia', p_avaliacao_data->>'zoneamento', COALESCE(p_avaliacao_data->'infraestrutura_lazer', '[]'::jsonb), (p_avaliacao_data->>'vagas_cobertas')::integer, (p_avaliacao_data->>'vagas_descobertas')::integer, (p_avaliacao_data->>'total_andares')::integer, COALESCE(p_avaliacao_data->'tipo_acabamento', '[]'::jsonb), p_avaliacao_data->>'numero_pavimentos', COALESCE(p_avaliacao_data->'ambientes_sociais', '[]'::jsonb), COALESCE(p_avaliacao_data->'ambientes_servico', '[]'::jsonb), COALESCE(p_avaliacao_data->'ambientes_outros', '[]'::jsonb), COALESCE(p_avaliacao_data->'fotos_meta', '[]'::jsonb)
  ) RETURNING id INTO v_avaliacao_id;

  INSERT INTO public.comparaveis (
    avaliacao_id, fonte, localizacao, tipo, area, area_privativa, area_construida, quartos, suites, banheiros, vagas, padrao, conservacao, posicao, andar, idade, condominio, caracteristicas, valor_anunciado
  )
  SELECT
    v_avaliacao_id, COALESCE(NULLIF(value->>'fonte', ''), 'Não informada'), value->>'localizacao', value->>'tipo', (value->>'area')::numeric, (value->>'area_privativa')::numeric, (value->>'area_construida')::numeric, (value->>'quartos')::integer, (value->>'suites')::integer, (value->>'banheiros')::integer, (value->>'vagas')::integer, value->>'padrao', value->>'conservacao', value->>'posicao', (value->>'andar')::integer, (value->>'idade')::integer, (value->>'condominio')::numeric, COALESCE(value->'caracteristicas', '[]'::jsonb), (value->>'valor_anunciado')::numeric
  FROM jsonb_array_elements(p_comparaveis_data);

  INSERT INTO public.resultados (
    avaliacao_id, user_id, valor_minimo, valor_central, valor_maximo, valor_unitario_medio, relatorio_json, versao_metodologia
  )
  VALUES (
    v_avaliacao_id,
    v_user_id,
    COALESCE(
      NULLIF(p_resultado_data->>'valor_minimo', '')::numeric,
      NULLIF(p_resultado_data->'relatorio_json'->'sumario_executivo'->>'valor_minimo', '')::numeric
    ),
    COALESCE(
      NULLIF(p_resultado_data->>'valor_central', '')::numeric,
      NULLIF(p_resultado_data->'relatorio_json'->'sumario_executivo'->>'valor_avaliado', '')::numeric
    ),
    COALESCE(
      NULLIF(p_resultado_data->>'valor_maximo', '')::numeric,
      NULLIF(p_resultado_data->'relatorio_json'->'sumario_executivo'->>'valor_maximo', '')::numeric
    ),
    COALESCE(
      NULLIF(p_resultado_data->>'valor_unitario_medio', '')::numeric,
      NULLIF(p_resultado_data->'relatorio_json'->'sumario_executivo'->>'valor_unitario_m2', '')::numeric
    ),
    p_resultado_data->'relatorio_json',
    (p_resultado_data->>'versao_metodologia')::integer
  );

  RETURN v_avaliacao_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.gravar_avaliacao_com_credito(jsonb, jsonb, jsonb, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gravar_avaliacao_com_credito(jsonb, jsonb, jsonb, boolean, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

UPDATE public.resultados
SET 
  valor_minimo = 460000,
  valor_central = 510000,
  valor_maximo = 550000,
  valor_unitario_medio = 6296
WHERE avaliacao_id = '150386f7-2460-4d2d-aeef-271e20779e5a'
  AND (relatorio_json->'sumario_executivo'->>'valor_avaliado')::numeric = 510000;
