import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(`Falha ao verificar permissão: ${error.message}`);
  if (!data) throw new Error("Acesso negado: apenas administradores.");
}

export const listarAfiliadosAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    const { data: afiliados, error } = await supabaseAdmin
      .from("afiliados")
      .select("id, user_id, nome, email, codigo, percentual_comissao, ativo, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Falha ao listar afiliados: ${error.message}`);

    const { data: indicacoes, error: indErr } = await supabaseAdmin
      .from("indicacoes_afiliado")
      .select("afiliado_id, valor_comissao, status");
    if (indErr) throw new Error(`Falha ao agregar indicações: ${indErr.message}`);

    const agg: Record<string, { total: number; pendente: number; pago: number }> = {};
    for (const i of indicacoes ?? []) {
      const a = (agg[i.afiliado_id] ||= { total: 0, pendente: 0, pago: 0 });
      a.total += 1;
      const v = Number(i.valor_comissao) || 0;
      if (i.status === "pago") a.pago += v;
      else if (i.status === "pendente") a.pendente += v;
    }

    return (afiliados ?? []).map((a: any) => ({
      id: a.id,
      user_id: a.user_id,
      nome: a.nome,
      email: a.email,
      codigo: a.codigo,
      percentual_comissao: Number(a.percentual_comissao),
      ativo: a.ativo,
      created_at: a.created_at,
      total_indicacoes: agg[a.id]?.total ?? 0,
      total_pendente: agg[a.id]?.pendente ?? 0,
      total_pago: agg[a.id]?.pago ?? 0,
    }));
  });

export const criarAfiliadoAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        nome: z.string().trim().min(1).max(120),
        email: z.string().trim().toLowerCase().email(),
        codigo: z
          .string()
          .trim()
          .min(3)
          .max(32)
          .regex(/^[A-Za-z0-9_-]+$/, "Código inválido"),
        percentual_comissao: z.number().min(0).max(100),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    const codigo = data.codigo.toUpperCase();

    // 1) Encontrar user por email
    let userId: string | null = null;
    let userNome: string | null = null;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email")
      .eq("email", data.email)
      .maybeSingle();
    if (profile) {
      userId = profile.id;
      userNome = profile.nome ?? null;
    } else {
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (listErr) throw new Error(`Erro ao buscar usuário: ${listErr.message}`);
      const u = list.users.find((x) => (x.email ?? "").toLowerCase() === data.email);
      if (u) userId = u.id;
    }
    if (!userId) {
      throw new Error(
        "Não existe usuário cadastrado com este e-mail. O afiliado precisa criar uma conta primeiro.",
      );
    }

    // 2) Verificar unicidade de código
    const { data: codExistente } = await supabaseAdmin
      .from("afiliados")
      .select("id")
      .eq("codigo", codigo)
      .maybeSingle();
    if (codExistente) throw new Error("Este código já está em uso. Escolha outro.");

    // 3) Verificar se o usuário já é afiliado
    const { data: jaAf } = await supabaseAdmin
      .from("afiliados")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (jaAf) throw new Error("Este usuário já é afiliado.");

    // 4) Inserir
    const { data: novo, error: insErr } = await supabaseAdmin
      .from("afiliados")
      .insert({
        user_id: userId,
        nome: data.nome,
        email: data.email,
        codigo,
        percentual_comissao: data.percentual_comissao,
        ativo: true,
      } as any)
      .select("id, nome, email, codigo, percentual_comissao, ativo")
      .single();
    if (insErr) throw new Error(`Falha ao criar afiliado: ${insErr.message}`);

    // 5) Garantir role afiliado
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "afiliado" } as any, {
        onConflict: "user_id,role",
        ignoreDuplicates: true,
      });
    if (roleErr) {
      console.warn("[admin/afiliados] falha ao gravar role", roleErr.message);
    }

    console.log("[admin/afiliados] novo afiliado", {
      admin: context.userId,
      target: userId,
      codigo,
    });

    return { ok: true, afiliado: novo, user_nome: userNome };
  });

export const atualizarAfiliadoAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        percentual_comissao: z.number().min(0).max(100).optional(),
        ativo: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    const update: Record<string, any> = {};
    if (typeof data.percentual_comissao === "number")
      update.percentual_comissao = data.percentual_comissao;
    if (typeof data.ativo === "boolean") update.ativo = data.ativo;
    if (Object.keys(update).length === 0) return { ok: true };

    const { data: updated, error } = await supabaseAdmin
      .from("afiliados")
      .update(update as any)
      .eq("id", data.id)
      .select("id, percentual_comissao, ativo")
      .single();
    if (error) throw new Error(`Falha ao atualizar afiliado: ${error.message}`);
    console.log("[admin/afiliados] atualizado", { admin: context.userId, id: data.id, update });
    return { ok: true, afiliado: updated };
  });

export const removerRoleAfiliado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ afiliado_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    const { data: af, error: afErr } = await supabaseAdmin
      .from("afiliados")
      .select("user_id")
      .eq("id", data.afiliado_id)
      .single();
    if (afErr) throw new Error(`Afiliado não encontrado: ${afErr.message}`);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", af.user_id)
      .eq("role", "afiliado");
    if (error) throw new Error(`Falha ao remover role: ${error.message}`);
    console.log("[admin/afiliados] role removido", { admin: context.userId, user: af.user_id });
    return { ok: true };
  });

export const getAfiliadoDetalheAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ afiliado_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    const { data: af, error: afErr } = await supabaseAdmin
      .from("afiliados")
      .select("id, user_id, nome, email, codigo, percentual_comissao, ativo")
      .eq("id", data.afiliado_id)
      .single();
    if (afErr) throw new Error(`Afiliado não encontrado: ${afErr.message}`);

    const { data: indicacoes, error: indErr } = await supabaseAdmin
      .from("indicacoes_afiliado")
      .select(
        "id, usuario_indicado_id, plano, valor_pago, valor_comissao, status, created_at, pago_em",
      )
      .eq("afiliado_id", data.afiliado_id)
      .order("created_at", { ascending: false });
    if (indErr) throw new Error(`Falha ao buscar indicações: ${indErr.message}`);

    // Emails dos indicados (admin vê completo, não mascarado)
    const ids = (indicacoes ?? []).map((i) => i.usuario_indicado_id);
    const emailMap: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .in("id", ids);
      for (const p of profs ?? []) if (p.email) emailMap[p.id] = p.email;
      const missing = ids.filter((id) => !emailMap[id]);
      if (missing.length) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        for (const u of list?.users ?? []) {
          if (u.email && missing.includes(u.id)) emailMap[u.id] = u.email;
        }
      }
    }

    return {
      afiliado: {
        id: af.id,
        nome: af.nome,
        email: af.email,
        codigo: af.codigo,
        percentual_comissao: Number(af.percentual_comissao),
        ativo: af.ativo,
      },
      indicacoes: (indicacoes ?? []).map((i) => ({
        id: i.id,
        email_indicado: emailMap[i.usuario_indicado_id] ?? "—",
        plano: i.plano,
        valor_pago: Number(i.valor_pago),
        valor_comissao: Number(i.valor_comissao),
        status: i.status,
        created_at: i.created_at,
        pago_em: i.pago_em,
      })),
    };
  });

export const marcarComissaoPaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ indicacao_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("indicacoes_afiliado")
      .update({ status: "pago", pago_em: new Date().toISOString() } as any)
      .eq("id", data.indicacao_id)
      .eq("status", "pendente")
      .select("id, status, pago_em")
      .maybeSingle();
    if (error) throw new Error(`Falha ao marcar como pago: ${error.message}`);
    if (!updated) throw new Error("Comissão não encontrada ou já estava paga.");
    console.log("[admin/afiliados] comissão paga", {
      admin: context.userId,
      id: data.indicacao_id,
    });
    return { ok: true, indicacao: updated };
  });
