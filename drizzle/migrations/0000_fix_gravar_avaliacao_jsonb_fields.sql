CREATE OR REPLACE FUNCTION public.gravar_avaliacao_com_credito(p_avaliacao_data jsonb, p_comparaveis_data jsonb, p_resultado_data jsonb, p_consome_credito boolean, p_idempotency_key uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_avaliacao_id uuid;
  v_user_id uuid;
  v_creditos int;
  v_plano text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Idempotência
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_avaliacao_id FROM public.avaliacoes WHERE idempotency_key = p_idempotency_key;
    IF v_avaliacao_id IS NOT NULL THEN
      RETURN v_avaliacao_id;
    END IF;
  END IF;

  -- Faturamento
  IF p_consome_credito THEN
    SELECT creditos_avulsos INTO v_creditos FROM public.profiles WHERE id = v_user_id FOR UPDATE;
    IF v_creditos < 1 THEN
      RAISE EXCEPTION 'Créditos insuficientes';
    END IF;
    UPDATE public.profiles SET creditos_avulsos = creditos_avulsos - 1 WHERE id = v_user_id;
  END IF;

  -- Inserir Avaliação
  INSERT INTO public.avaliacoes (
    user_id, tipo_relatorio, tipo_imovel, finalidade, localizacao, endereco_completo,
    area_total, area_privativa, area_construida, quartos, suites, banheiros, vagas,
    andar, padrao, conservacao, posicao, caracteristicas, observacoes, fotos, fotos_meta,
    idade_real, idade_aparente, posicao_solar, topografia, zoneamento, infraestrutura_lazer,
    vagas_cobertas, vagas_descobertas, total_andares, tipo_acabamento, numero_pavimentos,
    ambientes_sociais, ambientes_servico, ambientes_outros, status, idempotency_key
  ) VALUES (
    v_user_id,
    p_avaliacao_data->>'tipo_relatorio',
    p_avaliacao_data->>'tipo_imovel',
    p_avaliacao_data->>'finalidade',
    p_avaliacao_data->>'localizacao',
    p_avaliacao_data->>'endereco_completo',
    (p_avaliacao_data->>'area_total')::numeric,
    (p_avaliacao_data->>'area_privativa')::numeric,
    (p_avaliacao_data->>'area_construida')::numeric,
    (p_avaliacao_data->>'quartos')::int,
    (p_avaliacao_data->>'suites')::int,
    (p_avaliacao_data->>'banheiros')::int,
    (p_avaliacao_data->>'vagas')::int,
    (p_avaliacao_data->>'andar')::int,
    p_avaliacao_data->>'padrao',
    p_avaliacao_data->>'conservacao',
    p_avaliacao_data->>'posicao',
    COALESCE(p_avaliacao_data->'caracteristicas', '[]'::jsonb),
    p_avaliacao_data->>'observacoes',
    COALESCE(p_avaliacao_data->'fotos', '[]'::jsonb),
    COALESCE(p_avaliacao_data->'fotos_meta', '[]'::jsonb),
    (p_avaliacao_data->>'idade_real')::numeric,
    p_avaliacao_data->>'idade_aparente',
    p_avaliacao_data->>'posicao_solar',
    p_avaliacao_data->>'topografia',
    p_avaliacao_data->>'zoneamento',
    COALESCE(p_avaliacao_data->'infraestrutura_lazer', '[]'::jsonb),
    (p_avaliacao_data->>'vagas_cobertas')::int,
    (p_avaliacao_data->>'vagas_descobertas')::int,
    (p_avaliacao_data->>'total_andares')::int,
    COALESCE(p_avaliacao_data->'tipo_acabamento', '[]'::jsonb),
    p_avaliacao_data->>'numero_pavimentos',
    COALESCE(p_avaliacao_data->'ambientes_sociais', '[]'::jsonb),
    COALESCE(p_avaliacao_data->'ambientes_servico', '[]'::jsonb),
    COALESCE(p_avaliacao_data->'ambientes_outros', '[]'::jsonb),
    p_avaliacao_data->>'status',
    p_idempotency_key
  ) RETURNING id INTO v_avaliacao_id;

  -- Inserir Comparáveis
  INSERT INTO public.comparaveis (
    avaliacao_id, fonte, localizacao, tipo, area, area_privativa, area_construida,
    quartos, suites, banheiros, vagas, padrao, conservacao, posicao, andar,
    idade, condominio, caracteristicas, valor_anunciado
  )
  SELECT
    v_avaliacao_id,
    COALESCE(elem->>'fonte', 'Não informada'),
    elem->>'localizacao',
    elem->>'tipo',
    (elem->>'area')::numeric,
    (elem->>'area_privativa')::numeric,
    (elem->>'area_construida')::numeric,
    (elem->>'quartos')::int,
    (elem->>'suites')::int,
    (elem->>'banheiros')::int,
    (elem->>'vagas')::int,
    elem->>'padrao',
    elem->>'conservacao',
    elem->>'posicao',
    (elem->>'andar')::int,
    (elem->>'idade')::numeric,
    (elem->>'condominio')::numeric,
    COALESCE(elem->'caracteristicas', '[]'::jsonb),
    (elem->>'valor_anunciado')::numeric
  FROM jsonb_array_elements(p_comparaveis_data) AS elem;

  -- Inserir Resultado com Fallbacks Aprimorados
  INSERT INTO public.resultados (
    avaliacao_id, user_id, valor_minimo, valor_central, valor_maximo,
    valor_unitario_medio, relatorio_json, versao_metodologia
  ) VALUES (
    v_avaliacao_id,
    v_user_id,
    (NULLIF(COALESCE(
      p_resultado_data->>'valor_minimo',
      p_resultado_data->'relatorio_json'->'sumario_executivo'->>'valor_minimo'
    ), ''))::numeric,
    (NULLIF(COALESCE(
      p_resultado_data->>'valor_central',
      p_resultado_data->'relatorio_json'->'sumario_executivo'->>'valor_avaliado',
      p_resultado_data->'relatorio_json'->>'valor_avaliacao'
    ), ''))::numeric,
    (NULLIF(COALESCE(
      p_resultado_data->>'valor_maximo',
      p_resultado_data->'relatorio_json'->'sumario_executivo'->>'valor_maximo'
    ), ''))::numeric,
    (NULLIF(COALESCE(
      p_resultado_data->>'valor_unitario_medio',
      p_resultado_data->'relatorio_json'->'sumario_executivo'->>'valor_unitario_m2',
      p_resultado_data->'relatorio_json'->>'valor_m2'
    ), ''))::numeric,
    p_resultado_data->'relatorio_json',
    (p_resultado_data->>'versao_metodologia')::int
  );

  RETURN v_avaliacao_id;
END;
$function$;