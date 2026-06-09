import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";
import { z } from "zod";

const evaluationSchema = z.object({
  imovel: z.object({
    tipo: z.string(),
    finalidade: z.string(),
    localizacao: z.string(),
    area_total: z.number(),
    area_privativa: z.number().optional(),
    quartos: z.number(),
    suites: z.number().optional(),
    banheiros: z.number(),
    vagas: z.number(),
    andar: z.number().optional(),
    padrao: z.string(),
    conservacao: z.string(),
    posicao: z.string().optional(),
    caracteristicas: z.array(z.string()),
    observacoes: z.string().optional(),
  }),
  comparaveis: z.array(z.object({
    fonte: z.string(),
    localizacao: z.string(),
    area: z.number(),
    area_privativa: z.number().optional(),
    quartos: z.number().optional(),
    suites: z.number().optional(),
    banheiros: z.number().optional(),
    vagas: z.number().optional(),
    padrao: z.string().optional(),
    conservacao: z.string().optional(),
    posicao: z.string().optional(),
    andar: z.number().optional(),
    idade: z.number().optional(),
    condominio: z.number().optional(),
    caracteristicas: z.array(z.string()).optional(),
    valor: z.number(),
  })).min(3),
});

export const processarAvaliacaoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => evaluationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    console.log("Iniciando processamento no servidor para o usuário:", userId);

    try {
      // Enforça limite mensal para Plano Básico (plano = 'user')
      const { data: profile } = await supabase
        .from("profiles")
        .select("plano")
        .eq("id", userId)
        .maybeSingle();
      const plano = (profile?.plano ?? "user") as "user" | "pro" | "expert";
      if (plano === "user") {
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from("avaliacoes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", inicioMes.toISOString());
        if ((count ?? 0) >= 3) {
          throw new Error("Limite de 3 avaliações/mês do Plano Básico atingido. Faça upgrade em /planos.");
        }
      }

      const { data: aiResult, error: edgeError } = await supabase.functions.invoke("gerar-avaliacao", {
        body: data,
      });

      if (edgeError) {
        console.error("Erro ao chamar Edge Function:", edgeError);
        throw new Error("Erro na comunicação com o motor de IA: " + edgeError.message);
      }

      if (aiResult.error) {
        throw new Error(aiResult.error);
      }


      const { data: avaliacao, error: errA } = await supabase
        .from("avaliacoes")
        .insert({
          user_id: userId,
          tipo_relatorio: "Estudo de Mercado Simplificado",
          tipo_imovel: data.imovel.tipo,
          finalidade: data.imovel.finalidade,
          localizacao: data.imovel.localizacao,
          area_total: data.imovel.area_total,
          area_privativa: data.imovel.area_privativa ?? null,
          quartos: data.imovel.quartos,
          suites: data.imovel.suites ?? null,
          banheiros: data.imovel.banheiros,
          vagas: data.imovel.vagas,
          andar: data.imovel.andar ?? null,
          padrao: data.imovel.padrao,
          conservacao: data.imovel.conservacao,
          posicao: data.imovel.posicao ?? null,
          caracteristicas: data.imovel.caracteristicas,
          observacoes: data.imovel.observacoes,
          status: "concluido",
        })
        .select()
        .single();

      if (errA) throw errA;

      const comparaveisData = data.comparaveis.map(c => ({
        avaliacao_id: avaliacao.id,
        fonte: c.fonte,
        localizacao: c.localizacao,
        tipo: data.imovel.tipo,
        area: c.area,
        area_privativa: c.area_privativa ?? null,
        quartos: c.quartos ?? null,
        suites: c.suites ?? null,
        banheiros: c.banheiros ?? null,
        vagas: c.vagas ?? null,
        padrao: c.padrao ?? null,
        conservacao: c.conservacao ?? null,
        posicao: c.posicao ?? null,
        andar: c.andar ?? null,
        idade: c.idade ?? null,
        condominio: c.condominio ?? null,
        caracteristicas: c.caracteristicas ?? [],
        valor_anunciado: c.valor,
      }));

      const { error: errC } = await supabase.from("comparaveis").insert(comparaveisData);
      if (errC) console.error("Erro ao salvar comparáveis:", errC);

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

const idSchema = z.object({ id: z.string().uuid() });

export const getAvaliacaoDetalhe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: avaliacao, error: errA } = await supabase
      .from("avaliacoes")
      .select("*")
      .eq("id", data.id)
      .single();

    if (errA) throw new Error("Avaliação não encontrada");

    if (avaliacao.user_id !== userId) {
      throw new Error("Você não tem permissão para visualizar esta avaliação");
    }

    const [{ data: resultado, error: errR }, { data: comparaveis, error: errC }] = await Promise.all([
      supabase.from("resultados").select("*").eq("avaliacao_id", data.id).maybeSingle(),
      supabase.from("comparaveis").select("*").eq("avaliacao_id", data.id),
    ]);

    if (errR) throw new Error("Erro ao carregar resultado");
    if (errC) throw new Error("Erro ao carregar comparáveis");

    return { avaliacao, resultado: resultado ?? null, comparaveis: comparaveis ?? [] };
  });

export const listarAvaliacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("avaliacoes")
      .select("id, tipo_imovel, localizacao, created_at, status, resultados(valor_central)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []).map((a: any) => ({
      id: a.id,
      tipo_imovel: a.tipo_imovel,
      localizacao: a.localizacao,
      created_at: a.created_at,
      status: a.status,
      valor_central: a.resultados?.[0]?.valor_central ?? null,
    }));
  });
