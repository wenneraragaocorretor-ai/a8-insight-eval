import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um especialista em busca e análise de comparáveis imobiliários no mercado brasileiro.
Sua tarefa é encontrar anúncios reais de imóveis SIMILARES ao imóvel avaliado.

REGRAS DE VALIDAÇÃO (Obrigatórias):
1. Um comparável só é válido se possuir: URL direta do anúncio, fonte, localização, tipo, preço de oferta e área.
2. Não invente dados. Se a amostra for insuficiente, informe.
3. Tente completar a amostra até atingir pelo menos 5 comparáveis válidos (considerando os já fornecidos).
4. Identifique o preço expressamente como "preço de oferta".

LIMITES TÉCNICOS:
- Máximo de 5 pesquisas na web.
- Máximo de 15 URLs processadas.

FORMATO DE RETORNO (JSON):
{
  "comparaveis": [
    {
      "url": "string",
      "fonte": "string",
      "localizacao": "string",
      "tipo": "string",
      "valor_anunciado": number,
      "area": number,
      "quartos": number,
      "banheiros": number,
      "vagas": number,
      "origem": "busca_automatica"
    }
  ],
  "amostra_insuficiente": boolean,
  "motivos_descarte": ["string"]
}

Deduplique por URL normalizada e por combinação aproximada de características.`;

export const Route = createFileRoute("/api/public/buscar-comparaveis")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const anthropicKey = process.env.ANTHROPIC_API_KEY;
          if (!anthropicKey) {
            return Response.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 });
          }

          const { imovel, comparaveis_atuais = [] } = await request.json();

          const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-3-5-sonnet-20241022",
              max_tokens: 4000,
              system: SYSTEM_PROMPT,
              messages: [
                {
                  role: "user",
                  content: `Busque imóveis similares:
Tipo: ${imovel.tipo}
Localização: ${imovel.localizacao}
Área: ${imovel.area_total}m²
Quartos: ${imovel.quartos}

Complete a amostra até atingir 5 válidos. Já possuo ${comparaveis_atuais.length} comparáveis.`,
                },
              ],
              tools: [
                {
                  name: "web_search",
                  description:
                    "Pesquisa anúncios de imóveis em portais brasileiros (ZAP, VivaReal, Imovelweb).",
                  input_schema: {
                    type: "object",
                    properties: {
                      query: {
                        type: "string",
                        description: "Query de pesquisa, ex: 'apartamento venda Moema 100m2'",
                      },
                    },
                    required: ["query"],
                  },
                },
              ],
            }),
          });

          if (!claudeResp.ok) {
            const errTxt = await claudeResp.text();
            return Response.json(
              { error: `Erro Anthropic: ${claudeResp.status}`, details: errTxt },
              { status: claudeResp.status },
            );
          }

          const result = await claudeResp.json();

          return Response.json({
            info: "Etapa 1: Rota de busca automática criada com sucesso.",
            etapa: "Aguardando testes de tool-use para processar resultados de busca.",
            raw: result,
          });
        } catch (e: any) {
          return Response.json({ error: e.message }, { status: 500 });
        }
      },
    },
  },
});
