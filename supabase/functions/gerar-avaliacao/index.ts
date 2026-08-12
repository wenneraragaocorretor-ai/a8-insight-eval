import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.23.8'
import { areaBaseDe } from '../_shared/area-base.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ===== Validação rigorosa do JSON devolvido pela IA =====
class RespostaIAInvalida extends Error {}

/** Converte números vindos como texto ("R$ 450.000,00", "5.000,50") quando seguro. */
const numeroMonetario = z.preprocess((v) => {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const limpo = v.replace(/[^\d.,-]/g, '').trim()
    if (!limpo) return v
    const normalizado = limpo.includes(',')
      ? limpo.replace(/\./g, '').replace(',', '.')
      : limpo
    const n = Number(normalizado)
    return Number.isFinite(n) ? n : v
  }
  return v
}, z.number().finite().positive())

const textoObrigatorio = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() : v),
  z.string().min(1),
)

const listaTextos = z.array(z.union([z.string(), z.record(z.any())])).min(1)

const analiseBairroSchema = z.object({
  bairro: z.string(),
  cidade: z.string(),
  potencial_valorizacao: z.string(),
  tendencias_mercado: z.string(),
  descricao: z.string()
})

const perfilPublicoSchema = z.object({
  profissao: z.string(),
  renda_media: z.string(),
  preferencias: z.string(),
  interesses: z.string()
})

function buildResultadoSchema(qtdFotos: number) {
  return z
    .object({
      valor_minimo: numeroMonetario,
      valor_central: numeroMonetario,
      valor_maximo: numeroMonetario,
      valor_unitario_medio: numeroMonetario,
      area_base_calculo: numeroMonetario,
      area_base_tipo: textoObrigatorio,
      area_base_descricao: textoObrigatorio,
      resumo_texto: textoObrigatorio,
      pontos_positivos: listaTextos,
      pontos_atencao: z.array(z.union([z.string(), z.record(z.any())])),
      potencial_valorizacao: textoObrigatorio,
      tendencias_mercado: textoObrigatorio,
      perfil_profissao: textoObrigatorio,
      perfil_renda: textoObrigatorio,
      perfil_preferencias: textoObrigatorio,
      perfil_interesses: textoObrigatorio,
      analise_bairro: analiseBairroSchema,
      perfil_publico: perfilPublicoSchema,
      dicas_precificacao: listaTextos,
      estrategias_venda: listaTextos,
      dicas_anuncio: listaTextos,
      analise_fotos: z.string(),
      analise_fotos_individual: z.array(z.union([z.string(), z.record(z.any())])),
    })
    .passthrough()
    .superRefine((v, ctx) => {
      if (!(v.valor_minimo <= v.valor_central && v.valor_central <= v.valor_maximo)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['valor_central'],
          message: 'faixa incoerente: exige valor_minimo <= valor_central <= valor_maximo',
        })
      }
      if (v.analise_fotos_individual.length !== qtdFotos) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['analise_fotos_individual'],
          message: `esperado ${qtdFotos} item(ns), recebido ${v.analise_fotos_individual.length}`,
        })
      }
    })
}

const AI_GENERATION_ENABLED = Deno.env.get('AI_GENERATION_ENABLED') !== 'false'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // EMERGENCY SHUTDOWN CHECK
  if (!AI_GENERATION_ENABLED) {
    return new Response(JSON.stringify({ 
      error: 'Geração temporariamente indisponível para manutenção.',
      code: 'EMERGENCY_SHUTDOWN'
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    // 1. DADOS RECEBIDOS
    console.log("1. Dados recebidos:", JSON.stringify(body))

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const authHeader = req.headers.get('Authorization') ?? ''
    
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      throw new Error('Unauthorized: missing Bearer token')
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
      throw new Error('Unauthorized: invalid session')
    }
    const userId = userData.user.id
    const admin = createClient(supabaseUrl, serviceKey)

    const { imovel, comparaveis, correlationId, idempotencyKey } = body
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY não configurada')
    }

    // 2. CHAMANDO CLAUDE API
    console.log("2. Chamando Claude API...")
    
    // Baixa as fotos do imóvel (máximo 1 para teste/economia conforme solicitado)
    const fotosPaths: string[] = Array.isArray(imovel.fotos) ? imovel.fotos.slice(0, 1) : []
    const fotosImagens: Array<{ mediaType: string; base64: string }> = []
    
    if (fotosPaths.length > 0) {
      for (const p of fotosPaths) {
        try {
          const { data: blob, error } = await admin.storage.from('avaliacoes-fotos').download(p)
          if (error || !blob) {
            console.error(`Erro ao baixar foto ${p}:`, error)
            continue
          }
          
          const arrayBuffer = await blob.arrayBuffer()
          const uint8Array = new Uint8Array(arrayBuffer)
          
          // Conversão robusta para Base64 no Deno
          let binary = ''
          const len = uint8Array.byteLength
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(uint8Array[i])
          }
          const base64 = btoa(binary)
          
          const mediaType = blob.type || 'image/jpeg'
          
          // Validar se o MIME type é aceito pela Anthropic (image/jpeg, image/png, image/gif, image/webp)
          const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
          const finalMediaType = supportedTypes.includes(mediaType) ? mediaType : 'image/jpeg'
          
          fotosImagens.push({ mediaType: finalMediaType, base64 })
        } catch (e) {
          console.error('Falha ao processar foto:', p, e)
        }
      }
    }

    const baseImovel = areaBaseDe(imovel.tipo, imovel)
    const basesComparaveis = comparaveis.map((c: any) => areaBaseDe(imovel.tipo, c))
    const areaBaseDescricao = `Cálculo baseado em ${baseImovel.label}: ${baseImovel.area}m²`

    const padraoStr = String(imovel.padrao ?? "").toLowerCase()
    const tomGuia = padraoStr.includes("alto") || padraoStr.includes("luxo")
      ? "TOM DOS TEXTOS: sofisticado e valorizado, destacando exclusividade, requinte e acabamentos premium."
      : "TOM DOS TEXTOS: objetivo, claro e direto. Foque em funcionalidade, custo-benefício e adequação ao perfil real do imóvel."

    const systemPrompt = `Você é um especialista em avaliação imobiliária (NBR 14653-2). Adapte sempre a linguagem ao padrão construtivo informado pelo corretor. ${tomGuia}
    Retorne APENAS um JSON estruturado seguindo exatamente o schema informado. Não inclua conversas ou marcações markdown.`

    const userPrompt = `DADOS DO IMÓVEL AVALIANDO: ${JSON.stringify(imovel)} \n COMPARÁVEIS: ${JSON.stringify(comparaveis)}
    ${fotosImagens.length > 0 ? "Analise as fotos enviadas e preencha 'analise_fotos' (geral) e 'analise_fotos_individual' (um comentário por foto)." : "Nenhuma foto foi enviada para análise."}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
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

    // 3. RESPOSTA CLAUDE
    console.log("3. Resposta Claude:", response.status)
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Erro Anthropic API (${response.status}): ${errorText}`)
    }

    const aiResponse = await response.json()
    const rawContent = aiResponse?.content?.[0]?.text ?? ''
    
    // 4. CONTEÚDO RESPOSTA
    console.log("4. Conteúdo resposta:", JSON.stringify(rawContent))

    // 5. PARSEANDO JSON
    console.log("5. Parseando JSON...")
    // Limpeza rigorosa do JSON (remove markdown json tags e textos extras)
    let jsonText = rawContent;
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    } else {
      // Se não tem tags de code block, remove qualquer coisa antes do primeiro { e depois do último }
      const firstBrace = rawContent.indexOf('{');
      const lastBrace = rawContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonText = rawContent.substring(firstBrace, lastBrace + 1);
      }
    }
    
    // Limpeza secundária solicitada
    jsonText = jsonText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let result: any
    try {
      result = JSON.parse(jsonText)
    } catch (parseErr) {
      throw new Error(`Falha no parse do JSON. Texto extraído: ${jsonText.slice(0, 500)}`)
    }

    // 6. SALVANDO NO SUPABASE
    console.log("6. Salvando no Supabase...")
    await admin.from('ai_generation_requests').upsert({
      user_id: userId,
      idempotency_key: idempotencyKey,
      correlation_id: correlationId,
      status: 'completed',
      completed_at: new Date().toISOString(),
      model: 'claude-3-5-sonnet'
    })

    // 7. CONCLUÍDO!
    console.log("7. Concluído!")
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("ERRO COMPLETO:", error)
    return new Response(JSON.stringify({
      erro: true,
      error: error.message,
      mensagem: error.message,
      stack: error.stack
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})