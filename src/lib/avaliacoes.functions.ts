import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";
import { z } from "zod";

async function userIsAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(`Falha ao verificar admin: ${error.message}`);
  return !!data;
}

export const atualizarValorFinalCorretor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      avaliacao_id: z.string().uuid(),
      valor_final_corretor: z.number().nullable(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: aval, error: errA } = await supabase
      .from("avaliacoes")
      .select("user_id")
      .eq("id", data.avaliacao_id)
      .single();
    if (errA || !aval) throw new Error("Avaliação não encontrada");
    if (aval.user_id !== userId) throw new Error("Sem permissão para editar esta avaliação");

    if (data.valor_final_corretor !== null) {
      const { data: res } = await supabase
        .from("resultados")
        .select("valor_minimo, valor_maximo")
        .eq("avaliacao_id", data.avaliacao_id)
        .maybeSingle();
      const min = Number(res?.valor_minimo);
      const max = Number(res?.valor_maximo);
      if (Number.isFinite(min) && Number.isFinite(max)) {
        if (data.valor_final_corretor < min || data.valor_final_corretor > max) {
          throw new Error(
            `O valor deve estar entre ${min.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} e ${max.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} conforme o campo de arbítrio técnico (NBR 14653-2).`,
          );
        }
      }
    }

    const { error: errU } = await supabase
      .from("resultados")
      .update({ valor_final_corretor: data.valor_final_corretor })
      .eq("avaliacao_id", data.avaliacao_id);
    if (errU) throw new Error("Falha ao salvar valor: " + errU.message);

    return { ok: true, valor_final_corretor: data.valor_final_corretor };
  });



const evaluationSchema = z.object({
  imovel: z.object({
    tipo: z.string(),
    finalidade: z.string(),
    localizacao: z.string(),
    endereco_completo: z.string().optional(),
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
    fotos: z.array(z.string()).max(15).optional().default([]),
    fotos_meta: z.array(z.object({
      path: z.string(),
      legenda: z.string().optional().default(""),
      principal: z.boolean().optional().default(false),
    })).max(15).optional().default([]),
    // Ficha Técnica Detalhada (Plano Expert)
    idade_real: z.number().optional(),
    idade_aparente: z.string().optional(),
    posicao_solar: z.string().optional(),
    topografia: z.string().optional(),
    zoneamento: z.string().optional(),
    infraestrutura_lazer: z.array(z.string()).optional().default([]),
    vagas_cobertas: z.number().optional(),
    vagas_descobertas: z.number().optional(),
    total_andares: z.number().optional(),
    tipo_acabamento: z.array(z.string()).optional().default([]),
    numero_pavimentos: z.string().optional(),
    ambientes_sociais: z.array(z.string()).optional().default([]),
    ambientes_servico: z.array(z.string()).optional().default([]),
    ambientes_outros: z.array(z.string()).optional().default([]),
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

// Limites mensais de laudos por plano — DEVEM ser idênticos aos da
// Edge Function `gerar-avaliacao`.
const LIMITE_MENSAL_PROFISSIONAL = 8;
const LIMITE_MENSAL_EXPERT = 20;


export function limiteEdicoesPorPlano(plano: string): number | null {
  switch (plano) {
    case "expert":
      return null; // ilimitado
    case "profissional":
    case "pro":
      return 3;
    case "basico":
    case "user":
    default:
      return 1;
  }
}


export const processarAvaliacaoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => evaluationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    console.log("Iniciando processamento no servidor para o usuário:", userId);

    try {
      // Admins têm acesso ilimitado e não consomem créditos.
      const isAdmin = await userIsAdmin(supabase, userId);

      // Enforça limites por plano (admins ignoram).
      const { data: profile } = await supabase
        .from("profiles")
        .select("plano, creditos_avulsos")
        .eq("id", userId)
        .maybeSingle();
      const plano = (profile?.plano ?? "basico") as "basico" | "profissional" | "expert" | "user" | "pro";
      const creditos = profile?.creditos_avulsos ?? 0;

      // Flag: este laudo consome 1 crédito avulso?
      let consomeCredito = false;

      if (isAdmin) {
        // Sem limites, sem consumo.
      } else if (plano === "basico" || plano === "user") {
        // Plano Básico: pay-per-laudo. Precisa ter pelo menos 1 crédito.
        if (creditos < 1) {
          throw new Error("Você não tem laudos avulsos disponíveis. Compre um novo laudo Básico (R$ 157,00) em /planos.");
        }
        consomeCredito = true;
      } else if (plano === "profissional" || plano === "pro" || plano === "expert") {
        // Limites mensais idênticos aos da Edge Function `gerar-avaliacao`:
        // Profissional/Pro = 8 laudos/mês, Expert = 20 laudos/mês.
        // Ao atingir o limite, permite gerar consumindo 1 crédito avulso.
        const limite = plano === "expert" ? LIMITE_MENSAL_EXPERT : LIMITE_MENSAL_PROFISSIONAL;
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from("avaliacoes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", inicioMes.toISOString());
        if ((count ?? 0) >= limite) {
          if (creditos < 1) {
            throw new Error(
              plano === "expert"
                ? `Limite de ${limite} laudos/mês do Plano Expert atingido. Compre laudos adicionais por R$ 12,00 em /planos.`
                : `Limite de ${limite} laudos/mês do Plano Profissional atingido. Compre um laudo adicional ou faça upgrade para Expert em /planos.`,
            );
          }
          consomeCredito = true;
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
          endereco_completo: data.imovel.endereco_completo ?? null,
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
          fotos: data.imovel.fotos ?? [],
          fotos_meta: (() => {
            const baseMeta = Array.isArray(data.imovel.fotos_meta) ? data.imovel.fotos_meta : [];
            const aiPerFoto = Array.isArray(aiResult.analise_fotos_individual) ? aiResult.analise_fotos_individual : [];
            return baseMeta.map((m: any, i: number) => ({
              path: m.path,
              legenda: m.legenda ?? "",
              principal: !!m.principal,
              comentario_ia: typeof aiPerFoto[i] === "string" ? aiPerFoto[i] : (aiPerFoto[i]?.comentario ?? ""),
            }));
          })(),
          idade_real: data.imovel.idade_real ?? null,
          idade_aparente: data.imovel.idade_aparente ?? null,
          posicao_solar: data.imovel.posicao_solar ?? null,
          topografia: data.imovel.topografia ?? null,
          zoneamento: data.imovel.zoneamento ?? null,
          infraestrutura_lazer: data.imovel.infraestrutura_lazer ?? [],
          vagas_cobertas: data.imovel.vagas_cobertas ?? null,
          vagas_descobertas: data.imovel.vagas_descobertas ?? null,
          total_andares: data.imovel.total_andares ?? null,
          tipo_acabamento: data.imovel.tipo_acabamento ?? [],
          numero_pavimentos: data.imovel.numero_pavimentos ?? null,
          ambientes_sociais: data.imovel.ambientes_sociais ?? [],
          ambientes_servico: data.imovel.ambientes_servico ?? [],
          ambientes_outros: data.imovel.ambientes_outros ?? [],
          status: "concluido",
        })
        .select()
        .single();


      if (errA) throw errA;

      // Decrementa crédito avulso (Básico sempre; Expert quando excede 20/mês).
      if (consomeCredito) {
        await supabase
          .from("profiles")
          .update({ creditos_avulsos: Math.max(0, creditos - 1) })
          .eq("id", userId);
      }

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
        user_id: userId,
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

    const [{ data: resultado, error: errR }, { data: comparaveis, error: errC }, { data: profile }, { data: userData }] = await Promise.all([
      supabase.from("resultados").select("*").eq("avaliacao_id", data.id).maybeSingle(),
      supabase.from("comparaveis").select("*").eq("avaliacao_id", data.id),
      supabase.from("profiles").select("nome, plano, creci, cnai, outro_registro, telefone, cidade, estado, email, cpf, tipo, nome_imobiliaria, logo_url").eq("id", userId).maybeSingle(),
      supabase.auth.getUser(),
    ]);

    if (errR) throw new Error("Erro ao carregar resultado");
    if (errC) throw new Error("Erro ao carregar comparáveis");

    const authUser = userData?.user;
    const meta = (authUser?.user_metadata ?? {}) as Record<string, any>;
    const nomeCompleto =
      [meta.full_name, meta.name, meta.nome, profile?.nome].find((v) => typeof v === "string" && v.trim().length > 0) ??
      profile?.nome ?? "Corretor";

    const profileFinal = {
      ...(profile ?? {}),
      nome: nomeCompleto,
      email: profile?.email ?? authUser?.email ?? null,
    };

    return { avaliacao, resultado: resultado ?? null, comparaveis: comparaveis ?? [], profile: profileFinal };
  });


export const listarAvaliacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("avaliacoes")
      .select("id, tipo_imovel, localizacao, created_at, status, editado, ultima_edicao_em, edicoes_count, resultados(valor_central)")
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
      editado: !!a.editado,
      ultima_edicao_em: a.ultima_edicao_em ?? null,
      edicoes_count: a.edicoes_count ?? 0,
      valor_central: a.resultados?.[0]?.valor_central ?? null,
    }));
  });

export const regerarAvaliacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid() }).merge(evaluationSchema).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Carrega avaliação atual + valida ownership + limite
    const { data: atual, error: errAtual } = await supabase
      .from("avaliacoes")
      .select("*")
      .eq("id", data.id)
      .single();
    if (errAtual || !atual) throw new Error("Avaliação não encontrada");
    if (atual.user_id !== userId) throw new Error("Sem permissão para editar esta avaliação");

    const isAdmin = await userIsAdmin(supabase, userId);
    const { data: profile } = await supabase
      .from("profiles")
      .select("plano")
      .eq("id", userId)
      .maybeSingle();
    const plano = (profile?.plano ?? "basico") as string;
    const limite = isAdmin ? null : limiteEdicoesPorPlano(plano);
    const usadas = atual.edicoes_count ?? 0;
    if (limite !== null && usadas >= limite) {
      throw new Error(`Limite de ${limite} edição(ões) deste laudo atingido no plano atual.`);
    }


    // 2) Snapshot da versão atual antes de sobrescrever
    const [{ data: resultadoAtual }, { data: comparaveisAtuais }] = await Promise.all([
      supabase.from("resultados").select("*").eq("avaliacao_id", data.id).maybeSingle(),
      supabase.from("comparaveis").select("*").eq("avaliacao_id", data.id),
    ]);
    await supabase.from("avaliacoes_versoes").insert({
      avaliacao_id: data.id,
      versao: usadas + 1,
      snapshot: {
        avaliacao: atual,
        resultado: resultadoAtual ?? null,
        comparaveis: comparaveisAtuais ?? [],
      },
    });

    // 3) Reprocessa via IA
    const { data: aiResult, error: edgeError } = await supabase.functions.invoke("gerar-avaliacao", {
      body: { imovel: data.imovel, comparaveis: data.comparaveis },
    });
    if (edgeError) throw new Error("Erro na comunicação com o motor de IA: " + edgeError.message);
    if (aiResult?.error) throw new Error(aiResult.error);

    // 4) UPDATE avaliacao
    const fotosMetaUpd = (() => {
      const baseMeta = Array.isArray(data.imovel.fotos_meta) ? data.imovel.fotos_meta : [];
      const aiPerFoto = Array.isArray(aiResult.analise_fotos_individual) ? aiResult.analise_fotos_individual : [];
      return baseMeta.map((m: any, i: number) => ({
        path: m.path,
        legenda: m.legenda ?? "",
        principal: !!m.principal,
        comentario_ia: typeof aiPerFoto[i] === "string" ? aiPerFoto[i] : (aiPerFoto[i]?.comentario ?? ""),
      }));
    })();

    const { error: errUpd } = await supabase
      .from("avaliacoes")
      .update({
        tipo_imovel: data.imovel.tipo,
        finalidade: data.imovel.finalidade,
        localizacao: data.imovel.localizacao,
        endereco_completo: data.imovel.endereco_completo ?? null,
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
        fotos: data.imovel.fotos ?? [],
        fotos_meta: fotosMetaUpd,
        idade_real: data.imovel.idade_real ?? null,
        idade_aparente: data.imovel.idade_aparente ?? null,
        posicao_solar: data.imovel.posicao_solar ?? null,
        topografia: data.imovel.topografia ?? null,
        zoneamento: data.imovel.zoneamento ?? null,
        infraestrutura_lazer: data.imovel.infraestrutura_lazer ?? [],
        vagas_cobertas: data.imovel.vagas_cobertas ?? null,
        vagas_descobertas: data.imovel.vagas_descobertas ?? null,
        total_andares: data.imovel.total_andares ?? null,
        tipo_acabamento: data.imovel.tipo_acabamento ?? [],
        numero_pavimentos: data.imovel.numero_pavimentos ?? null,
        ambientes_sociais: data.imovel.ambientes_sociais ?? [],
        ambientes_servico: data.imovel.ambientes_servico ?? [],
        ambientes_outros: data.imovel.ambientes_outros ?? [],
        editado: true,
        edicoes_count: usadas + 1,
        ultima_edicao_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (errUpd) throw new Error("Falha ao atualizar avaliação: " + errUpd.message);

    // 5) Substitui comparáveis
    await supabase.from("comparaveis").delete().eq("avaliacao_id", data.id);
    const comparaveisNovos = data.comparaveis.map((c) => ({
      avaliacao_id: data.id,
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
    await supabase.from("comparaveis").insert(comparaveisNovos);

    // 6) UPSERT resultado
    if (resultadoAtual) {
      await supabase
        .from("resultados")
        .update({
          valor_minimo: aiResult.valor_minimo,
          valor_central: aiResult.valor_central,
          valor_maximo: aiResult.valor_maximo,
          valor_unitario_medio: aiResult.valor_unitario_medio,
          relatorio_json: aiResult,
        })
        .eq("avaliacao_id", data.id);
    } else {
      await supabase.from("resultados").insert({
        avaliacao_id: data.id,
        user_id: userId,
        valor_minimo: aiResult.valor_minimo,
        valor_central: aiResult.valor_central,
        valor_maximo: aiResult.valor_maximo,
        valor_unitario_medio: aiResult.valor_unitario_medio,
        relatorio_json: aiResult,
      });
    }

    return { id: data.id, ...aiResult };
  });

