-- 1. Adicionar coluna de idempotência na tabela avaliacoes
ALTER TABLE public.avaliacoes 
ADD COLUMN IF NOT EXISTS idempotency_key uuid UNIQUE;

-- 2. Atualizar a trigger de proteção para ser mais explícita e segura
-- Em vez de confiar apenas em SECURITY DEFINER (que herda o dono da função),
-- vamos verificar se a alteração vem de uma origem autorizada.
CREATE OR REPLACE FUNCTION public.protect_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Permite alterações apenas se:
  -- 1. For o service_role (backend confiável)
  -- 2. Estivermos explicitamente dentro da nossa RPC autorizada
  -- (Utilizamos uma variável de sessão personalizada para autorização interna)
  
  IF CURRENT_USER IN ('authenticated', 'anon') AND 
     current_setting('app.authorized_billing_update', true) IS DISTINCT FROM 'true' THEN
    IF (
      NEW.plano IS DISTINCT FROM OLD.plano OR
      NEW.creditos_avulsos IS DISTINCT FROM OLD.creditos_avulsos OR
      NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id OR
      NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id OR
      NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR
      NEW.plan_price_id IS DISTINCT FROM OLD.plan_price_id OR
      NEW.subscription_current_period_end IS DISTINCT FROM OLD.subscription_current_period_end OR
      NEW.is_beta_tester IS DISTINCT FROM OLD.is_beta_tester OR
      NEW.beta_plano IS DISTINCT FROM OLD.beta_plano OR
      NEW.beta_expira_em IS DISTINCT FROM OLD.beta_expira_em
    ) THEN
      RAISE EXCEPTION 'Alteração não autorizada em campos de faturamento.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Atualizar a RPC para suportar idempotência e autorização explícita
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
SET search_path = public
AS $function$
DECLARE
  v_avaliacao_id uuid;
  v_user_id uuid;
  v_creditos integer;
  v_existing_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;

  -- Verifica idempotência
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.avaliacoes 
    WHERE idempotency_key = p_idempotency_key AND user_id = v_user_id;
    
    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id; -- Retorna o laudo já processado sem cobrar novamente
    END IF;
  END IF;

  -- Autoriza explicitamente o update de faturamento nesta sessão (bypass seguro da trigger)
  PERFORM set_config('app.authorized_billing_update', 'true', true);

  -- Bloqueia registro de créditos para evitar race conditions
  IF p_consome_credito THEN
    SELECT creditos_avulsos INTO v_creditos FROM public.profiles WHERE id = v_user_id FOR UPDATE;
    IF v_creditos < 1 THEN RAISE EXCEPTION 'Créditos insuficientes'; END IF;
  END IF;

  -- Insere a avaliação
  INSERT INTO public.avaliacoes (
    user_id, idempotency_key, tipo_relatorio, tipo_imovel, finalidade, localizacao, endereco_completo,
    area_total, area_privativa, area_construida, quartos, suites, banheiros, vagas,
    andar, padrao, conservacao, posicao, caracteristicas, observacoes, fotos, fotos_meta,
    idade_real, idade_aparente, posicao_solar, topografia, zoneamento, infraestrutura_lazer,
    vagas_cobertas, vagas_descobertas, total_andares, tipo_acabamento, numero_pavimentos,
    ambientes_sociais, ambientes_servico, ambientes_outros, status
  )
  SELECT
    v_user_id, p_idempotency_key, (p_avaliacao_data->>'tipo_relatorio'), (p_avaliacao_data->>'tipo_imovel'),
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

  -- Insere comparáveis
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

  -- Insere resultado
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

  -- Debita crédito
  IF p_consome_credito THEN
    UPDATE public.profiles
    SET creditos_avulsos = creditos_avulsos - 1
    WHERE id = v_user_id;
  END IF;

  RETURN v_avaliacao_id;
END;
$function$;

-- Re-garantir permissões
REVOKE EXECUTE ON FUNCTION public.gravar_avaliacao_com_credito(jsonb, jsonb, jsonb, boolean, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gravar_avaliacao_com_credito(jsonb, jsonb, jsonb, boolean, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.gravar_avaliacao_com_credito(jsonb, jsonb, jsonb, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gravar_avaliacao_com_credito(jsonb, jsonb, jsonb, boolean, uuid) TO service_role;
