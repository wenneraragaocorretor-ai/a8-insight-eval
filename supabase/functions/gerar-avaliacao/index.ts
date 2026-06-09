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
    const { imovel, comparaveis } = await req.json()
    const anthropicApiKey = Deno.env.get('CHAVE_API_ANTROPICA')

    if (!anthropicApiKey) {
      throw new Error('CHAVE_API_ANTROPICA não configurada')
    }

    console.log('Iniciando processamento de avaliação para:', imovel.localizacao)

    // Baixa as fotos do imóvel (caminhos no bucket privado) usando service role
    const fotosPaths: string[] = Array.isArray(imovel.fotos) ? imovel.fotos.slice(0, 3) : []
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
      if (tn.includes('apart')) {
        const r = pick(im.area_privativa, total)
        return { ...r, label: r.fonte === 'privativa' ? 'área privativa' : 'área total' }
      }
      if (tn.includes('casa')) {
        const r = pick(im.area_privativa, total)
        return { ...r, label: r.fonte === 'privativa' ? 'área construída' : 'área total' }
      }
      if (tn.includes('terreno')) {
        return { area: Number(total) || 0, fonte: 'total' as const, label: 'área total do terreno' }
      }
      const r = pick(im.area_privativa, total)
      return { ...r, label: r.fonte === 'privativa' ? 'área privativa/útil' : 'área total' }
    }

    const baseImovel = areaBaseDe(imovel)
    const basesComparaveis = comparaveis.map((c: any) => areaBaseDe(c, imovel.tipo))
    const areaBaseDescricao = `Cálculo baseado em ${baseImovel.label}: ${baseImovel.area}m²`

    const systemPrompt = `Você é um especialista em avaliação imobiliária (NBR 14653-2).
Faça a HOMOGENEIZAÇÃO dos comparáveis em relação ao imóvel avaliando, considerando:
área (conforme regra abaixo), quartos, suítes, banheiros, vagas, padrão construtivo,
estado de conservação, posição (esquina, meio de quadra, encravado, gleba),
andar (se apartamento), idade aproximada, condomínio e características presentes
(piscina, churrasqueira, elevador, condomínio fechado, área de lazer, etc.).

REGRA DE ÁREA BASE (ABNT NBR 14653-2) — OBRIGATÓRIA para R$/m²:
- Apartamento: usar a ÁREA PRIVATIVA. Se ausente, usar área total.
- Casa: usar a ÁREA CONSTRUÍDA (edificada). Se ausente, usar área total.
- Terreno: usar a ÁREA TOTAL do terreno.
- Sala Comercial / Galpão: usar a ÁREA PRIVATIVA/ÚTIL. Se ausente, usar área total.
A mesma regra se aplica a cada comparável (use a área privativa quando disponível).
O "valor_unitario_medio" DEVE ser calculado sobre a área base — NÃO use área total quando houver privativa.

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
  "perfil_preferencias": "O que esse público busca em um imóvel (1-2 frases).",
  "perfil_interesses": "Hábitos e interesses culturais/de lazer típicos (1-2 frases).",
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
  "dicas_anuncio": ["Destaque a vista livre", "Enfatize a proximidade com o metrô"]
}`

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
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Erro na API da Anthropic:', error)
      throw new Error('Falha na comunicação com a IA')
    }

    const data = await response.json()
    const content = data.content[0].text
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonText = jsonMatch ? jsonMatch[1].trim() : content.trim()
    const result = JSON.parse(jsonText)

    // Garante que a área base do cálculo sempre vai no resultado
    result.area_base_calculo = result.area_base_calculo ?? baseImovel.area
    result.area_base_tipo = result.area_base_tipo ?? baseImovel.label
    result.area_base_descricao = result.area_base_descricao ?? areaBaseDescricao



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
