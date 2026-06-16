import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authorize caller: must be a valid Supabase user
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = userData.user.id

    // Plan/credit gate (defense in depth — main check is in server fn)
    const admin = createClient(supabaseUrl, serviceKey)
    const { data: profile } = await admin
      .from('profiles')
      .select('plano, creditos_avulsos')
      .eq('id', userId)
      .maybeSingle()
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Perfil não encontrado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const plano = profile.plano as string | null
    const creditos = Number(profile.creditos_avulsos ?? 0)
    if (!plano || (plano !== 'basico' && plano !== 'profissional' && plano !== 'expert')) {
      return new Response(JSON.stringify({ error: 'Plano inválido' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (plano === 'basico' && creditos < 1) {
      return new Response(JSON.stringify({ error: 'Sem créditos disponíveis' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (plano === 'profissional' || plano === 'expert') {
      // Início do mês em UTC para evitar edge-cases de fuso horário
      const now = new Date()
      const inicioMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const { count } = await admin
        .from('avaliacoes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', inicioMes.toISOString())
      const limite = plano === 'expert' ? 20 : 8
      if ((count ?? 0) >= limite && creditos < 1) {
        return new Response(JSON.stringify({
          error: `Limite mensal ${plano === 'expert' ? 'Expert' : 'Profissional'} atingido (${limite} laudos). Adquira créditos avulsos para continuar.`,
        }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const { imovel, comparaveis } = await req.json()
    const anthropicApiKey = Deno.env.get('CHAVE_API_ANTROPICA')

    if (!anthropicApiKey) {
      throw new Error('CHAVE_API_ANTROPICA não configurada')
    }


    // log mínimo, sem expor localização completa (LGPD)
    console.log('Iniciando processamento de avaliação')

    // Baixa as fotos do imóvel (caminhos no bucket privado) usando service role
    const fotosPaths: string[] = Array.isArray(imovel.fotos) ? imovel.fotos.slice(0, 15) : []
    const fotosImagens: Array<{ mediaType: string; base64: string }> = []
    if (fotosPaths.length > 0) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      if (supabaseUrl && serviceKey) {
        const supa = createClient(supabaseUrl, serviceKey)
        for (const p of fotosPaths) {
          try {
            const { data: blob, error } = await supa.storage.from('avaliacoes-fotos').download(p)
            if (error || !blob) continue
            const buf = new Uint8Array(await blob.arrayBuffer())
            // base64 encode
            let bin = ''
            for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
            const base64 = btoa(bin)
            const mediaType = blob.type || (p.toLowerCase().endsWith('.png') ? 'image/png' : p.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg')
            fotosImagens.push({ mediaType, base64 })
          } catch (e) {
            console.error('Falha ao baixar foto', p, e)
          }
        }
      }
    }


    // ABNT NBR 14653-2 — área base do cálculo conforme tipo de imóvel
    const pick = (priv: any, total: any) => {
      const p = Number(priv); const t = Number(total)
      if (Number.isFinite(p) && p > 0) return { area: p, fonte: 'privativa' as const }
      return { area: Number.isFinite(t) ? t : 0, fonte: 'total' as const }
    }
    const areaBaseDe = (im: any, tipoRef?: string) => {
      const tn = String(tipoRef ?? im.tipo ?? '').toLowerCase()
      const total = im.area_total ?? im.area
      if (tn.includes('terreno')) {
        return { area: Number(total) || 0, fonte: 'total' as const, label: 'área total do terreno' }
      }
      if (tn.includes('apart')) {
        const r = pick(im.area_privativa, total)
        return { ...r, label: r.fonte === 'privativa' ? 'área privativa' : 'área total' }
      }
      if (tn.includes('casa') || tn.includes('sobrado')) {
        const r = pick(im.area_privativa, total)
        return { ...r, label: r.fonte === 'privativa' ? 'área construída' : 'área total' }
      }
      if (tn.includes('galp')) {
        const r = pick(im.area_privativa, total)
        return { ...r, label: r.fonte === 'privativa' ? 'área privativa do galpão' : 'área total' }
      }
      const r = pick(im.area_privativa, total)
      return { ...r, label: r.fonte === 'privativa' ? 'área privativa/útil' : 'área total' }
    }


    const baseImovel = areaBaseDe(imovel)
    const basesComparaveis = comparaveis.map((c: any) => areaBaseDe(c, imovel.tipo))
    const areaBaseDescricao = `Cálculo baseado em ${baseImovel.label}: ${baseImovel.area}m²`

    const padraoStr = String(imovel.padrao ?? "").toLowerCase()
    const tomGuia = padraoStr.includes("alto") || padraoStr.includes("luxo")
      ? "TOM DOS TEXTOS: sofisticado e valorizado, destacando exclusividade, requinte e acabamentos premium."
      : "TOM DOS TEXTOS: objetivo, claro e direto. NÃO use termos como 'alto padrão', 'luxo', 'sofisticado', 'premium' ou 'requintado'. Foque em funcionalidade, custo-benefício e adequação ao perfil real do imóvel."
    const systemPrompt = `Você é um especialista em avaliação imobiliária (NBR 14653-2). Adapte sempre a linguagem ao padrão construtivo informado pelo corretor — não assuma que o imóvel é de alto padrão. ${tomGuia}
Faça a HOMOGENEIZAÇÃO dos comparáveis em relação ao imóvel avaliando, considerando:
área (conforme regra abaixo), quartos, suítes, banheiros, vagas, padrão construtivo,
estado de conservação, posição (esquina, meio de quadra, encravado, gleba),
andar (se apartamento), idade aproximada, condomínio, características presentes
(piscina, churrasqueira, elevador, condomínio fechado, área de lazer, etc.) e a
COMPOSIÇÃO DE AMBIENTES informada (sociais, de serviço e outros) — ambientes
adicionais como cozinha gourmet, escritório, closet, adega, terraço e similares
agregam valor e devem ser ponderados na homogeneização.

REGRA DE ÁREA BASE (ABNT NBR 14653-2) — OBRIGATÓRIA para R$/m²:
- Apartamento: usar a ÁREA PRIVATIVA. Se ausente, usar área total.
- Casa: usar a ÁREA CONSTRUÍDA (edificada). Se ausente, usar área total.
- Terreno: usar a ÁREA TOTAL do terreno.
- Sala Comercial / Galpão: usar a ÁREA PRIVATIVA/ÚTIL. Se ausente, usar área total.
A mesma regra se aplica a cada comparável (use a área privativa quando disponível).
O "valor_unitario_medio" DEVE ser calculado sobre a área base — NÃO use área total quando houver privativa.

ANÁLISE DE APROVEITAMENTO DO LOTE — REGRA OBRIGATÓRIA E RESTRITIVA:
PROIBIDO concluir "baixo aproveitamento" ou "aproveitamento moderado" do
terreno baseando-se na simples relação matemática entre área construída e
área total do lote. NÃO inclua esse tipo de observação em "pontos_atencao"
para imóveis residenciais comuns (casas, sobrados, apartamentos térreos).
Uma casa com 120m² construídos em um terreno de 250m² é COMPLETAMENTE
ADEQUADA — recuos, quintal, jardim e área livre são esperados e desejáveis
em uso residencial, NUNCA caracterizam ponto de atenção.

O aproveitamento do lote SÓ pode ser mencionado como ponto de atenção
quando houver evidência contextual clara e específica, como:
- Zoneamento que permite gabarito muito maior do que o utilizado em região
  nobre com forte pressão construtiva (potencial econômico desperdiçado);
- Terreno em área de altíssimo valor comercial mantido com construção
  mínima e sem outras unidades;
- Subutilização explícita relatada pelo corretor.
Na ausência dessas evidências, NÃO mencione aproveitamento do lote em
"pontos_atencao". Para casas e sobrados em lotes residenciais padrão,
considere o aproveitamento como adequado e SILENCIE o assunto.


Para este imóvel, a área base já está determinada: "${baseImovel.label}" = ${baseImovel.area}m².
Para cada comparável, use o campo "area_base" indicado no input.

Calcule o valor unitário homogeneizado (R$/m² sobre a área base) e aplique ao imóvel alvo,
gerando faixa mínima, central e máxima (intervalo de confiança).
Além da avaliação, gere conteúdo qualitativo personalizado para o imóvel e a região.
Retorne APENAS um JSON estruturado (sem comentários, sem markdown). TODOS os campos abaixo são OBRIGATÓRIOS
e devem ser preenchidos com base nas características reais — NÃO retorne strings vazias, "—" ou "Informação não disponível":
{
  "valor_minimo": 450000,
  "valor_central": 500000,
  "valor_maximo": 550000,
  "valor_unitario_medio": 5000,
  "area_base_calculo": ${baseImovel.area},
  "area_base_tipo": "${baseImovel.label}",
  "area_base_descricao": "${areaBaseDescricao}",
  "resumo_texto": "O imóvel apresenta excelente conservação...",
  "pontos_positivos": ["2 vagas de garagem, diferencial valorizado", "Condomínio fechado com área de lazer", "Bom estado de conservação"],
  "pontos_atencao": ["1º andar pode ter menor valorização", "Área total superior à privativa indica áreas comuns proporcionalmente altas"],
  "potencial_valorizacao": "Texto curto (2-3 frases) sobre o potencial de valorização do bairro/cidade nos próximos anos.",
  "tendencias_mercado": "Texto curto (2-3 frases) sobre tendências imobiliárias locais atuais.",
  "perfil_profissao": "Profissão predominante na região (ex: profissionais liberais, executivos, servidores públicos).",
  "perfil_renda": "Faixa de renda média estimada (ex: R$ 8.000 a R$ 15.000).",
  "perfil_preferencias": "O que esse público busca em um imóvel — específico para a tipologia, faixa de renda e localização deste imóvel (1-2 frases).",
  "perfil_interesses": "Interesses PRÁTICOS e RELEVANTES para o comprador-alvo deste imóvel específico, baseados em tipologia, localização, padrão e renda. Exemplos válidos: proximidade de escolas, segurança do bairro, custo de condomínio, potencial de renda com aluguel, mobilidade urbana, valorização patrimonial, área de lazer no condomínio, espaço para pets/família, home office. NÃO use hobbies genéricos (teatro, cinema, gastronomia) desconectados do imóvel. 2-3 itens objetivos em uma frase corrida.",

  "analise_bairro": {
    "bairro": "Nome do bairro",
    "cidade": "Cidade/UF",
    "potencial_valorizacao": "Mesmo conteúdo do campo potencial_valorizacao acima.",
    "tendencias_mercado": "Mesmo conteúdo do campo tendencias_mercado acima.",
    "descricao": "Resumo da região (infraestrutura, lazer, mobilidade), 3-4 frases."
  },
  "perfil_publico": {
    "profissao": "Mesmo conteúdo de perfil_profissao.",
    "renda_media": "Mesmo conteúdo de perfil_renda.",
    "preferencias": "Mesmo conteúdo de perfil_preferencias.",
    "interesses": "Mesmo conteúdo de perfil_interesses."
  },
  "dicas_precificacao": ["Iniciar 5% acima do valor central", "Ajustar após 30 dias"],
  "estrategias_venda": ["Tour virtual em alta", "Parceria com home staging"],
  "dicas_anuncio": ["Destaque a vista livre", "Enfatize a proximidade com o metrô"],
  "analise_fotos": "${fotosImagens.length > 0 ? 'Análise visual geral consolidada das fotos enviadas: padrão construtivo aparente, estado de conservação real, acabamentos visíveis (piso, esquadrias, bancadas, pintura), pontos positivos e pontos de atenção observados nas imagens. Se houver discrepância entre as fotos e os dados informados pelo corretor, mencione-a explicitamente. 4-6 frases.' : ''}",
  "analise_fotos_individual": ${fotosImagens.length > 0 ? `[${fotosImagens.map((_, i) => `"Foto ${i + 1}: comentário técnico curto (2-3 linhas) sobre estado de conservação aparente, tipo de acabamento visível, pontos positivos e pontos de atenção."`).join(", ")}]` : "[]"}
}

${fotosImagens.length > 0 ? `ANÁLISE DAS FOTOS (OBRIGATÓRIO): As ${fotosImagens.length} imagens em anexo são fotos reais do imóvel avaliando, na ordem em que aparecem (Foto 1, Foto 2, ...). Para cada foto, gere um comentário técnico curto (2 a 3 linhas) cobrindo: estado de conservação aparente, tipo de acabamento visível, pontos positivos e pontos de atenção. Devolva esses comentários no array "analise_fotos_individual" — UM item por foto, NA MESMA ORDEM das imagens, totalizando exatamente ${fotosImagens.length} itens. Em "analise_fotos" devolva a análise geral consolidada (padrão, conservação, acabamentos, discrepâncias com os dados informados). Se as fotos contradisserem os dados do corretor, mencione e ajuste o valor estimado.` : ''}`


    const fmt = (v: any) => (v === undefined || v === null || v === "" ? "-" : v);
    const userPrompt = `DADOS DO IMÓVEL AVALIANDO:
- Tipo: ${imovel.tipo}
- Finalidade: ${imovel.finalidade}
- Localização: ${imovel.localizacao}
- Área total: ${imovel.area_total}m²
- Área privativa/construída: ${fmt(imovel.area_privativa)}m²
- ÁREA BASE DO CÁLCULO (NBR 14653-2): ${baseImovel.area}m² (${baseImovel.label})
- Quartos: ${imovel.quartos} | Suítes: ${fmt(imovel.suites)} | Banheiros: ${imovel.banheiros} | Vagas: ${imovel.vagas}
- Andar: ${fmt(imovel.andar)}
- Padrão: ${imovel.padrao} | Conservação: ${imovel.conservacao} | Posição: ${fmt(imovel.posicao)}
- Características: ${(imovel.caracteristicas || []).join(", ") || "-"}
- Ambientes sociais: ${(imovel.ambientes_sociais || []).join(", ") || "-"}
- Ambientes de serviço: ${(imovel.ambientes_servico || []).join(", ") || "-"}
- Outros ambientes: ${(imovel.ambientes_outros || []).join(", ") || "-"}
- Observações: ${fmt(imovel.observacoes)}

COMPARÁVEIS (${comparaveis.length}):
${comparaveis.map((c: any, i: number) => {
  const b = basesComparaveis[i]
  const vu = b.area > 0 ? (Number(c.valor) / b.area).toFixed(2) : '-'
  return `
Comparável #${i + 1} (${c.fonte}):
  - Localização: ${fmt(c.localizacao)}
  - Área total: ${c.area}m² | Privativa: ${fmt(c.area_privativa)}m²
  - area_base: ${b.area}m² (${b.label})
  - Valor anunciado: R$ ${c.valor} | R$/m² sobre área base: ${vu}
  - Quartos: ${fmt(c.quartos)} | Suítes: ${fmt(c.suites)} | Banheiros: ${fmt(c.banheiros)} | Vagas: ${fmt(c.vagas)}
  - Padrão: ${fmt(c.padrao)} | Conservação: ${fmt(c.conservacao)} | Posição: ${fmt(c.posicao)}
  - Andar: ${fmt(c.andar)} | Idade: ${fmt(c.idade)} anos | Condomínio: R$ ${fmt(c.condominio)}
  - Características: ${(c.caracteristicas || []).join(", ") || "-"}`
}).join("\n")}
`


    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              ...fotosImagens.flatMap((img, i) => ([
                { type: 'text', text: `Foto ${i + 1}:` },
                { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } },
              ])),
              { type: 'text', text: userPrompt },
            ],
          },
        ],
      }),
    })


    if (!response.ok) {
      const error = await response.text()
      console.error('Erro na API da Anthropic:', error)
      throw new Error('Falha na comunicação com a IA')
    }

    const data = await response.json()
    const content = data?.content?.[0]?.text ?? ''
    if (!content) {
      console.error('Resposta inesperada da Anthropic:', JSON.stringify(data).slice(0, 500))
      throw new Error('A IA retornou uma resposta vazia. Tente novamente em alguns segundos.')
    }
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonText = jsonMatch ? jsonMatch[1].trim() : content.trim()
    let result: any
    try {
      result = JSON.parse(jsonText)
    } catch (parseErr) {
      console.error('JSON inválido da IA. Trecho:', jsonText.slice(0, 300), parseErr)
      throw new Error('A IA retornou resposta incompleta. Tente novamente ou reduza o número de fotos.')
    }

    // Garante que a área base do cálculo sempre vai no resultado
    result.area_base_calculo = result.area_base_calculo ?? baseImovel.area
    result.area_base_tipo = result.area_base_tipo ?? baseImovel.label
    result.area_base_descricao = result.area_base_descricao ?? areaBaseDescricao

    // ===== Análise do bairro com busca web (Claude web_search) =====
    try {
      const localizacao = String(imovel.localizacao ?? '').trim()
      if (localizacao) {
        const bairroSystem = `Você é um analista imobiliário. Você DEVE usar a ferramenta web_search para pesquisar dados reais e atuais sobre o bairro antes de responder. Use APENAS informações encontradas na pesquisa. Se não encontrar dados suficientes, informe explicitamente que não há dados disponíveis para esse bairro. Responda SOMENTE com um JSON válido no formato exato solicitado, sem texto fora do JSON e sem cercas de código.`

        const bairroUser = `Antes de analisar o bairro, pesquise informações reais e atuais sobre: ${localizacao}.

Busque dados sobre:
- Perfil socioeconômico
- Infraestrutura disponível
- Valorização imobiliária
- Segurança
- Comércio e serviços próximos

Devolva EXATAMENTE este JSON (sem texto extra, sem markdown):
{
  "bairro": "Nome do bairro",
  "cidade": "Cidade/UF",
  "potencial_valorizacao": "2-3 frases sobre potencial de valorização, baseado APENAS nos dados encontrados na pesquisa. Se sem dados, diga 'Não há dados públicos suficientes para o bairro.'",
  "tendencias_mercado": "2-3 frases sobre tendências imobiliárias locais atuais, baseado APENAS na pesquisa. Se sem dados, diga 'Não há dados públicos suficientes para o bairro.'",
  "descricao": "Resumo da região cobrindo perfil socioeconômico, infraestrutura, segurança, comércio e serviços (3-5 frases), baseado APENAS na pesquisa. Se sem dados, diga 'Não há dados públicos suficientes para o bairro.'"
}`

        const bairroResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5',
            max_tokens: 2048,
            system: bairroSystem,
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
            messages: [{ role: 'user', content: bairroUser }],
          }),
        })

        if (bairroResp.ok) {
          const bairroData = await bairroResp.json()
          const blocks: any[] = Array.isArray(bairroData?.content) ? bairroData.content : []
          const textOut = blocks.filter((b) => b?.type === 'text').map((b) => b.text).join('\n').trim()
          const m = textOut.match(/\{[\s\S]*\}/)
          if (m) {
            try {
              const analiseBairro = JSON.parse(m[0])
              result.analise_bairro = { ...(result.analise_bairro ?? {}), ...analiseBairro }
              if (analiseBairro.potencial_valorizacao) result.potencial_valorizacao = analiseBairro.potencial_valorizacao
              if (analiseBairro.tendencias_mercado) result.tendencias_mercado = analiseBairro.tendencias_mercado
            } catch (e) {
              console.error('Falha ao parsear JSON da análise do bairro:', e)
            }
          } else {
            console.error('Resposta da busca do bairro sem JSON detectável')
          }
        } else {
          console.error('Falha na busca web do bairro:', bairroResp.status, await bairroResp.text())
        }
      }
    } catch (e) {
      console.error('Erro na análise do bairro com web_search:', (e as Error).message)
      // não bloqueia o laudo
    }



    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Erro na Edge Function:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
