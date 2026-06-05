import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";
import { z } from "zod";

const evaluationSchema = z.object({
  imovel: z.object({
    tipo: z.string(),
    finalidade: z.string(),
    localizacao: z.string(),
    area_total: z.number(),
    quartos: z.number(),
    banheiros: z.number(),
    vagas: z.number(),
    andar: z.number().optional(),
    padrao: z.string(),
    conservacao: z.string(),
    caracteristicas: z.array(z.string()),
    observacoes: z.string().optional(),
  }),
  comparaveis: z.array(z.object({
    fonte: z.string(),
    localizacao: z.string(),
    area: z.number(),
    valor: z.number(),
  })).min(3),
});

export const processarAvaliacaoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => evaluationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada no servidor");
    }

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
  "dicas_anuncio": ["Destaque a vista livre", "Enfatize a proximidade com o metrô", ...]
}`;

    const userPrompt = `DADOS DO IMÓVEL:
- Tipo: ${data.imovel.tipo}
- Localização: ${data.imovel.localizacao}
- Área: ${data.imovel.area_total}m²
- Quartos: ${data.imovel.quartos}
- Padrão: ${data.imovel.padrao}
- Conservação: ${data.imovel.conservacao}
- Características: ${data.imovel.caracteristicas.join(", ")}

COMPARÁVEIS:
${data.comparaveis.map(c => `- ${c.fonte}: ${c.area}m² por R$ ${c.valor} (${c.localizacao})`).join("\n")}
`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      throw new Error("Falha ao processar avaliação com IA");
    }

    const result = await response.json();
    const aiResult = JSON.parse(result.choices[0].message.content);

    // Salvar no banco de dados
    const { data: avaliacao, error: errA } = await supabase
      .from("avaliacoes")
      .insert({
        user_id: userId,
        tipo_relatorio: "Estudo de Mercado Simplificado",
        tipo_imovel: data.imovel.tipo,
        finalidade: data.imovel.finalidade,
        localizacao: data.imovel.localizacao,
        area_total: data.imovel.area_total,
        quartos: data.imovel.quartos,
        banheiros: data.imovel.banheiros,
        vagas: data.imovel.vagas,
        andar: data.imovel.andar,
        padrao: data.imovel.padrao,
        conservacao: data.imovel.conservacao,
        caracteristicas: data.imovel.caracteristicas,
        observacoes: data.imovel.observacoes,
        status: "concluido",
      })
      .select()
      .single();

    if (errA) throw errA;

    // Salvar comparáveis
    const comparaveisData = data.comparaveis.map(c => ({
      avaliacao_id: avaliacao.id,
      fonte: c.fonte,
      localizacao: c.localizacao,
      tipo: data.imovel.tipo,
      area: c.area,
      valor_anunciado: c.valor,
    }));
    await supabase.from("comparaveis").insert(comparaveisData);

    // Salvar resultado
    await supabase.from("resultados").insert({
      avaliacao_id: avaliacao.id,
      valor_minimo: aiResult.valor_minimo,
      valor_central: aiResult.valor_central,
      valor_maximo: aiResult.valor_maximo,
      valor_unitario_medio: aiResult.valor_unitario_medio,
      relatorio_json: aiResult,
    });

    return { id: avaliacao.id, ...aiResult };
  });
