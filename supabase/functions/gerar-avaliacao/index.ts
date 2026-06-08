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

    const systemPrompt = `Você é um especialista em avaliação imobiliária.
Analise os dados do imóvel avaliando e os comparáveis fornecidos para estimar o valor de mercado.
Calcule o valor unitário médio (R$/m²) e aplique ao imóvel alvo, ajustando levemente por suas características.
Retorne APENAS um JSON estruturado conforme o exemplo:
{
  "valor_minimo": 450000,
  "valor_central": 500000,
  "valor_maximo": 550000,
  "valor_unitario_medio": 5000,
  "resumo_texto": "O imóvel apresenta excelente conservação...",
  "dicas_anuncio": ["Destaque a vista livre", "Enfatize a proximidade com o metrô"]
}`

    const userPrompt = `DADOS DO IMÓVEL:
- Tipo: ${imovel.tipo}
- Localização: ${imovel.localizacao}
- Área: ${imovel.area_total}m²
- Quartos: ${imovel.quartos}
- Padrão: ${imovel.padrao}
- Conservação: ${imovel.conservacao}
- Características: ${(imovel.caracteristicas || []).join(", ")}

COMPARÁVEIS:
${comparaveis.map((c: any) => `- ${c.fonte}: ${c.area}m² por R$ ${c.valor} (${c.localizacao})`).join("\n")}
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
    const result = JSON.parse(content)

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
