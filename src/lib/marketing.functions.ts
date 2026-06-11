import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";
import { z } from "zod";

const idSchema = z.object({ id: z.string().uuid() });

export type MarketingResultado = {
  publico: {
    faixa_etaria: string;
    perfil_familiar: string;
    faixa_renda: string;
    estilo_vida: string;
    motivacao_compra: string;
  };
  divulgacao: {
    canais: string[];
    melhor_horario: string;
    prazo_venda: string;
    dicas_precificacao: string;
    desconto_maximo: string;
  };
  anuncio: {
    titulo: string;
    descricao_portal: string;
    whatsapp: string;
    hashtags: string[];
  };
};

export const gerarMarketingAvaliacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ data, context }): Promise<MarketingResultado> => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente no servidor");

    const { data: avRaw, error: e1 } = await supabase
      .from("avaliacoes")
      .select("*")
      .eq("id", data.id)
      .single();
    if (e1 || !avRaw) throw new Error("Avaliação não encontrada");
    if (avRaw.user_id !== userId) throw new Error("Sem permissão");
    const av = avRaw as any;

    const { data: res } = await supabase
      .from("resultados")
      .select("*")
      .eq("avaliacao_id", data.id)
      .maybeSingle();

    const rel: any = res?.relatorio_json || {};
    const valorCentral = Number(res?.valor_central ?? 0);
    const valorMin = Number(res?.valor_minimo ?? 0);
    const valorMax = Number(res?.valor_maximo ?? 0);

    const padraoStr = String(av.padrao ?? "").toLowerCase();
    const tomGuia = padraoStr.includes("alto") || padraoStr.includes("luxo")
      ? "Tom SOFISTICADO e valorizado, destacando exclusividade, requinte e acabamentos premium."
      : "Tom OBJETIVO, claro e direto, sem exageros nem termos como 'alto padrão', 'luxo' ou 'sofisticado'. Foque em utilidade, custo-benefício e funcionalidade para o dia a dia.";
    const sistema = `Você é um especialista em marketing imobiliário no Brasil. Adapte o tom dos textos ao padrão construtivo informado: ${tomGuia} Não assuma que o imóvel é de alto padrão por padrão. Gere um plano de marketing personalizado e prático para o imóvel descrito, baseando-se nos dados reais informados (valor, localização, padrão, ambientes, lazer, acabamentos, análise de fotos). Não invente diferenciais que não existem. Retorne APENAS JSON estruturado conforme o schema exato. Sem markdown, sem comentários.`;

    const userPrompt = `DADOS DO IMÓVEL:
- Tipo: ${av.tipo_imovel}
- Localização: ${av.localizacao}
- Endereço: ${av.endereco_completo ?? "—"}
- Área total: ${av.area_total} m² | Privativa: ${av.area_privativa ?? "—"} m²
- Quartos: ${av.quartos} | Suítes: ${av.suites ?? 0} | Banheiros: ${av.banheiros} | Vagas: ${av.vagas}
- Padrão: ${av.padrao} | Conservação: ${av.conservacao}
- Características: ${(av.caracteristicas || []).join(", ") || "—"}
- Infra de lazer: ${(av.infraestrutura_lazer || []).join(", ") || "—"}
- Acabamentos: ${(av.tipo_acabamento || []).join(", ") || "—"}
- Ambientes sociais: ${(av.ambientes_sociais || []).join(", ") || "—"}
- Ambientes serviço: ${(av.ambientes_servico || []).join(", ") || "—"}
- Outros ambientes: ${(av.ambientes_outros || []).join(", ") || "—"}

VALORES SUGERIDOS:
- Valor central: R$ ${valorCentral.toLocaleString("pt-BR")}
- Faixa: R$ ${valorMin.toLocaleString("pt-BR")} a R$ ${valorMax.toLocaleString("pt-BR")}

ANÁLISE PRÉVIA DA IA:
${rel.resumo_texto ?? ""}
Pontos positivos: ${(rel.pontos_positivos || []).join("; ")}
Pontos de atenção: ${(rel.pontos_atencao || []).join("; ")}
Análise de fotos: ${rel.analise_fotos ?? "—"}

Devolva JSON EXATO neste formato:
{
  "publico": {
    "faixa_etaria": "ex: 35 a 55 anos",
    "perfil_familiar": "ex: famílias com filhos em idade escolar",
    "faixa_renda": "ex: a partir de R$ 25.000/mês",
    "estilo_vida": "2-3 frases sobre estilo, hobbies, prioridades",
    "motivacao_compra": "1-2 frases sobre a principal motivação"
  },
  "divulgacao": {
    "canais": ["Zap Imóveis", "Instagram", "..."],
    "melhor_horario": "ex: terças e quintas, 18h-21h",
    "prazo_venda": "ex: 60 a 120 dias",
    "dicas_precificacao": "2-3 frases sobre preço lançamento vs negociação",
    "desconto_maximo": "ex: até 7% sem desvalorizar"
  },
  "anuncio": {
    "titulo": "máx 60 caracteres",
    "descricao_portal": "texto completo para Zap/OLX/Viva Real, 6-10 linhas, destacando diferenciais reais",
    "whatsapp": "máx 3 linhas com call-to-action",
    "hashtags": ["#...", "#...", "..."]
  }
}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("AI Gateway erro:", resp.status, txt);
      if (resp.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
      if (resp.status === 402) throw new Error("Créditos da IA esgotados.");
      throw new Error("Falha ao gerar marketing");
    }

    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      const m = String(content).match(/```(?:json)?\s*([\s\S]*?)```/);
      parsed = JSON.parse(m ? m[1].trim() : String(content).trim());
    } catch {
      throw new Error("Resposta da IA inválida");
    }

    return parsed as MarketingResultado;
  });
