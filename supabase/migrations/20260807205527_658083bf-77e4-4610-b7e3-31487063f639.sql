CREATE OR REPLACE FUNCTION public.gravar_avaliacao_com_credito(
  p_avaliacao_data jsonb,
  p_comparaveis_data jsonb,
  p_resultado_data jsonb,
  p_consome_credito boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avaliacao_id uuid;
  v_user_id uuid;
  v_creditos integer;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- 1. Verifica créditos se necessário
  IF p_consome_credito THEN
    SELECT creditos_avulsos INTO v_creditos FROM public.profiles WHERE id = v_user_id FOR UPDATE;
    IF v_creditos < 1 THEN
      RAISE EXCEPTION 'Créditos insuficientes';
    END IF;
  END IF;

  -- 2. Insere a avaliação
  INSERT INTO public.avaliacoes (
    user_id, tipo_relatorio, tipo_imovel, finalidade, localizacao, endereco_completo,
    area_total, area_privativa, area_construida, quartos, suites, banheiros, vagas,
    andar, padrao, conservacao, posicao, caracteristicas, observacoes, fotos, fotos_meta,
    idade_real, idade_aparente, posicao_solar, topografia, zoneamento, infraestrutura_lazer,
    vagas_cobertas, vagas_descobertas, total_andares, tipo_acabamento, numero_pavimentos,
    ambientes_sociais, ambientes_servico, ambientes_outros, status
  )
  SELECT
    v_user_id, (p_avaliacao_data->>'tipo_relatorio'), (p_avaliacao_data->>'tipo_imovel'),
    (p_avaliacao_data->>'finalidade'), (p_avaliacao_data->>'localizacao'),
    (p_avaliacao_data->>'endereco_completo'), (p_avaliacao_data->'area_total')::numeric,
    (p_avaliacao_data->'area_privativa')::numeric, (p_avaliacao_data->'area_construida')::numeric,
    (p_avaliacao_data->'quartos')::integer, (p_avaliacao_data->'suites')::integer,
    (p_avaliacao_data->'banheiros')::integer, (p_avaliacao_data->'vagas')::integer,
    (p_avaliacao_data->'andar')::integer, (p_avaliacao_data->>'padrao'),
    (p_avaliacao_data->>'conservacao'), (p_avaliacao_data->>'posicao'),
    (p_avaliacao_data->'caracteristicas'), (p_avaliacao_data->>'observacoes'),
    (p_avaliacao_data->'fotos'), (p_avaliacao_data->'fotos_meta'),
    (p_avaliacao_data->'idade_real')::numeric, (p_avaliacao_data->>'idade_aparente'),
    (p_avaliacao_data->>'posicao_solar'), (p_avaliacao_data->>'topografia'),
    (p_avaliacao_data->>'zoneamento'), (p_avaliacao_data->'infraestrutura_lazer'),
    (p_avaliacao_data->'vagas_cobertas')::integer, (p_avaliacao_data->'vagas_descobertas')::integer,
    (p_avaliacao_data->'total_andares')::integer, (p_avaliacao_data->'tipo_acabamento'),
    (p_avaliacao_data->>'numero_pavimentos'), (p_avaliacao_data->'ambientes_sociais'),
    (p_avaliacao_data->'ambientes_servico'), (p_avaliacao_data->'ambientes_outros'),
    (p_avaliacao_data->>'status')
  RETURNING id INTO v_avaliacao_id;

  -- 3. Insere os comparáveis
  INSERT INTO public.comparaveis (
    avaliacao_id, fonte, localizacao, tipo, area, area_privativa, area_construida,
    quartos, suites, banheiros, vagas, padrao, conservacao, posicao, andar, idade,
    condominio, caracteristicas, valor_anunciado
  )
  SELECT
    v_avaliacao_id, (elem->>'fonte'), (elem->>'localizacao'), (elem->>'tipo'),
    (elem->'area')::numeric, (elem->'area_privativa')::numeric, (elem->'area_construida')::numeric,
    (elem->'quartos')::integer, (elem->'suites')::integer, (elem->'banheiros')::integer,
    (elem->'vagas')::integer, (elem->>'padrao'), (elem->>'conservacao'), (elem->>'posicao'),
    (elem->'andar')::integer, (elem->'idade')::numeric, (elem->'condominio')::numeric,
    (elem->'caracteristicas'), (elem->'valor_anunciado')::numeric
  FROM jsonb_array_elements(p_comparaveis_data) AS elem;

  -- 4. Insere o resultado
  INSERT INTO public.resultados (
    avaliacao_id, user_id, valor_minimo, valor_central, valor_maximo,
    valor_unitario_medio, relatorio_json, versao_metodologia
  )
  VALUES (
    v_avaliacao_id, v_user_id, (p_resultado_data->'valor_minimo')::numeric,
    (p_resultado_data->'valor_central')::numeric, (p_resultado_data->'valor_maximo')::numeric,
    (p_resultado_data->'valor_unitario_medio')::numeric, (p_resultado_data->'relatorio_json'),
    COALESCE((p_resultado_data->'versao_metodologia')::integer, 2)
  );

  -- 5. Debita crédito se necessário
  IF p_consome_credito THEN
    UPDATE public.profiles
    SET creditos_avulsos = creditos_avulsos - 1
    WHERE id = v_user_id;
  END IF;

  RETURN v_avaliacao_id;
END;
$$;
