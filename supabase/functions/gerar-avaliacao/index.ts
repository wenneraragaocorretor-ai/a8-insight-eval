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

    const systemPrompt = `Você é um especialista em avaliação imobiliária (NBR 14653).
Faça a HOMOGENEIZAÇÃO dos comparáveis em relação ao imóvel avaliando, considerando:
área total/privativa, quartos, suítes, banheiros, vagas, padrão construtivo,
estado de conservação, posição (esquina, meio de quadra, encravado, gleba),
andar (se apartamento), idade aproximada, condomínio e características presentes
(piscina, churrasqueira, elevador, condomínio fechado, área de lazer, etc.).
Calcule o valor unitário homogeneizado (R$/m²) e aplique ao imóvel alvo,
gerando faixa mínima, central e máxima (intervalo de confiança).
Além da avaliação, gere conteúdo qualitativo personalizado para o imóvel e a região,
com base no tipo de imóvel, localização (bairro/cidade) e características informadas.
Retorne APENAS um JSON estruturado (sem comentários, sem markdown) conforme o exemplo:
{
  "valor_minimo": 450000,
  "valor_central": 500000,
  "valor_maximo": 550000,
  "valor_unitario_medio": 5000,
  "resumo_texto": "O imóvel apresenta excelente conservação...",
  "pontos_positivos": ["Localização privilegiada", "Boa metragem", "Bem conservado"],
  "pontos_negativos": ["Sem vaga coberta", "Andar baixo"],
  "analise_bairro": {
    "bairro": "Nome do bairro",
    "cidade": "Cidade/UF",
    "potencial_valorizacao": "Texto sobre o potencial de valorização da região, 2-3 frases.",
    "tendencias_mercado": "Texto sobre tendências atuais do mercado local, 2-3 frases.",
    "descricao": "Resumo da região (infraestrutura, lazer, mobilidade), 3-4 frases."
  },
  "perfil_publico": {
    "profissao": "Profissão predominante dos moradores da região.",
    "renda_media": "Faixa de renda média estimada.",
    "preferencias": "O que esse público busca em um imóvel.",
    "interesses": "Hábitos e interesses culturais/de lazer."
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
- Área privativa: ${fmt(imovel.area_privativa)}m²
- Quartos: ${imovel.quartos} | Suítes: ${fmt(imovel.suites)} | Banheiros: ${imovel.banheiros} | Vagas: ${imovel.vagas}
- Andar: ${fmt(imovel.andar)}
- Padrão: ${imovel.padrao} | Conservação: ${imovel.conservacao} | Posição: ${fmt(imovel.posicao)}
- Características: ${(imovel.caracteristicas || []).join(", ") || "-"}
- Observações: ${fmt(imovel.observacoes)}

COMPARÁVEIS (${comparaveis.length}):
${comparaveis.map((c: any, i: number) => `
Comparável #${i + 1} (${c.fonte}):
  - Localização: ${fmt(c.localizacao)}
  - Área total: ${c.area}m² | Privativa: ${fmt(c.area_privativa)}m²
  - Valor anunciado: R$ ${c.valor}
  - Quartos: ${fmt(c.quartos)} | Suítes: ${fmt(c.suites)} | Banheiros: ${fmt(c.banheiros)} | Vagas: ${fmt(c.vagas)}
  - Padrão: ${fmt(c.padrao)} | Conservação: ${fmt(c.conservacao)} | Posição: ${fmt(c.posicao)}
  - Andar: ${fmt(c.andar)} | Idade: ${fmt(c.idade)} anos | Condomínio: R$ ${fmt(c.condominio)}
  - Características: ${(c.caracteristicas || []).join(", ") || "-"}`).join("\n")}
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
        max_tokens: 1024,
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
