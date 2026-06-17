import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";

const PLANO_VALUES = ["basico", "profissional", "expert"] as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(`Falha ao verificar permissão: ${error.message}`);
  if (!data) throw new Error("Acesso negado: apenas administradores.");
}

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { admin: !!data };
  });

export const buscarUsuarioPorEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ email: z.string().email().trim().toLowerCase() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    // Procura no auth.users via Admin API
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw new Error(`Erro ao listar usuários: ${listErr.message}`);
    const user = list.users.find((u) => (u.email ?? "").toLowerCase() === data.email);
    if (!user) return { found: false as const };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, plano, subscription_status, creditos_avulsos, stripe_subscription_id, plan_price_id, subscription_current_period_end")
      .eq("id", user.id)
      .maybeSingle();

    return {
      found: true as const,
      user: { id: user.id, email: user.email, created_at: user.created_at },
      profile,
    };
  });

export const redefinirPlanoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      user_id: z.string().uuid(),
      plano: z.enum(PLANO_VALUES),
      creditos_avulsos: z.number().int().min(0).max(999).optional(),
      limparAssinatura: z.boolean().optional().default(true),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    const update: Record<string, any> = { plano: data.plano };
    if (typeof data.creditos_avulsos === "number") {
      update.creditos_avulsos = data.creditos_avulsos;
    }
    if (data.limparAssinatura) {
      update.subscription_status = null;
      update.stripe_subscription_id = null;
      update.plan_price_id = null;
      update.subscription_current_period_end = null;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("profiles")
      .update(update as any)
      .eq("id", data.user_id)
      .select("id, plano, subscription_status, creditos_avulsos")
      .single();
    if (error) throw new Error(`Falha ao redefinir plano: ${error.message}`);

    console.log("[admin] Plano redefinido", {
      admin: context.userId,
      target: data.user_id,
      plano: updated?.plano,
    });

    return { ok: true, profile: updated };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    const [profilesRes, laudosRes, receitaRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("plano", { count: "exact" }),
      supabaseAdmin.from("avaliacoes").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("cobrancas_avulsas").select("valor_centavos, status"),
    ]);

    const totalUsuarios = profilesRes.count ?? 0;
    const porPlano = { basico: 0, profissional: 0, expert: 0, sem_plano: 0 };
    for (const row of (profilesRes.data ?? []) as Array<{ plano: string | null }>) {
      const p = row.plano;
      if (p === "expert") porPlano.expert++;
      else if (p === "profissional" || p === "pro") porPlano.profissional++;
      else if (p === "basico" || p === "user") porPlano.basico++;
      else porPlano.sem_plano++;
    }

    const totalLaudos = laudosRes.count ?? 0;

    let receitaCentavos = 0;
    for (const c of (receitaRes.data ?? []) as Array<{ valor_centavos: number | null; status: string | null }>) {
      if (c.status === "paid" || c.status === "succeeded" || c.status === "complete") {
        receitaCentavos += c.valor_centavos ?? 0;
      }
    }

    return {
      totalUsuarios,
      porPlano,
      totalLaudos,
      receitaCentavos,
    };
  });

export const listarUsuariosAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      busca: z.string().trim().max(200).optional().default(""),
      limit: z.number().int().min(1).max(200).optional().default(100),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    // Lista todos os perfis
    let query = supabaseAdmin
      .from("profiles")
      .select("id, nome, email, plano, subscription_status, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.busca) {
      const q = data.busca.replace(/[%_]/g, "");
      query = query.or(`nome.ilike.%${q}%,email.ilike.%${q}%`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(`Falha ao listar usuários: ${error.message}`);

    // Enriquecer com e-mail real do auth quando profile.email estiver vazio
    const missingEmail = (rows ?? []).filter((r: any) => !r.email).map((r: any) => r.id);
    let authEmails: Record<string, string> = {};
    if (missingEmail.length) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      for (const u of list?.users ?? []) {
        if (u.email && missingEmail.includes(u.id)) authEmails[u.id] = u.email;
      }
    }

    return (rows ?? []).map((r: any) => ({
      id: r.id,
      nome: r.nome,
      email: r.email ?? authEmails[r.id] ?? null,
      plano: r.plano,
      subscription_status: r.subscription_status,
      created_at: r.created_at,
    }));
  });
