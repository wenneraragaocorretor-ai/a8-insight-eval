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
    console.log("Iniciando processamento no servidor para o usuário:", userId);
    console.log("Dados recebidos:", JSON.stringify(data));

    try {
      // Chamando a Edge Function do Supabase
      const { data: aiResult, error: edgeError } = await supabase.functions.invoke("gerar-avaliacao", {
        body: data,
      });

      if (edgeError) {
        console.error("Erro ao chamar Edge Function:", edgeError);
        throw new Error("Erro na comunicação com o motor de IA: " + edgeError.message);
      }

      if (aiResult.error) {
        console.error("Erro retornado pela IA:", aiResult.error);
        throw new Error(aiResult.error);
      }

      console.log("Resultado da IA recebido com sucesso");

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
          padrao: data.imovel.padrao,
          conservacao: data.imovel.conservacao,
          caracteristicas: data.imovel.caracteristicas,
          observacoes: data.imovel.observacoes,
          status: "concluido",
        })
        .select()
        .single();

      if (errA) {
        console.error("Erro ao salvar avaliação:", errA);
        throw errA;
      }

      // Salvar comparáveis
      const comparaveisData = data.comparaveis.map(c => ({
        avaliacao_id: avaliacao.id,
        fonte: c.fonte,
        localizacao: c.localizacao,
        tipo: data.imovel.tipo,
        area: c.area,
        valor_anunciado: c.valor,
      }));
      
      const { error: errC } = await supabase.from("comparaveis").insert(comparaveisData);
      if (errC) console.error("Erro ao salvar comparáveis:", errC);

      // Salvar resultado
      const { error: errR } = await supabase.from("resultados").insert({
        avaliacao_id: avaliacao.id,
        valor_minimo: aiResult.valor_minimo,
        valor_central: aiResult.valor_central,
        valor_maximo: aiResult.valor_maximo,
        valor_unitario_medio: aiResult.valor_unitario_medio,
        relatorio_json: aiResult,
      });
      if (errR) console.error("Erro ao salvar resultado final:", errR);

      return { id: avaliacao.id, ...aiResult };
    } catch (error: any) {
      console.error("Erro crítico no fluxo de avaliação:", error);
      throw new Error(error.message || "Falha ao processar avaliação");
    }
  });
