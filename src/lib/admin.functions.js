import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";
const PLANO_VALUES = ["basico", "profissional", "expert"];
async function assertAdmin(supabase, userId) {
    const { data, error } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
    if (error)
        throw new Error(`Falha ao verificar permissão: ${error.message}`);
    if (!data)
        throw new Error("Acesso negado: apenas administradores.");
}
export const amIAdmin = createServerFn({ method: "GET" })
    .middleware([requireSupabaseAuth])
    .handler(async ({ context }) => {
    const { data, error } = await context.supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle();
    if (error)
        throw new Error(`Falha ao verificar admin: ${error.message}`);
    return { admin: !!data };
});
export const buscarUsuarioPorEmail = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((data) => z.object({ email: z.string().email().trim().toLowerCase() }).parse(data))
    .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    // Procura no auth.users via Admin API
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
    });
    if (listErr)
        throw new Error(`Erro ao listar usuários: ${listErr.message}`);
    const user = list.users.find((u) => (u.email ?? "").toLowerCase() === data.email);
    if (!user)
        return { found: false };
    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, nome, plano, subscription_status, creditos_avulsos, stripe_subscription_id, plan_price_id, subscription_current_period_end")
        .eq("id", user.id)
        .maybeSingle();
    return {
        found: true,
        user: { id: user.id, email: user.email, created_at: user.created_at },
        profile,
    };
});
export const redefinirPlanoUsuario = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((data) => z.object({
    user_id: z.string().uuid(),
    plano: z.enum(PLANO_VALUES),
    creditos_avulsos: z.number().int().min(0).max(999).optional(),
    limparAssinatura: z.boolean().optional().default(true),
}).parse(data))
    .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    const update = { plano: data.plano };
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
        .update(update)
        .eq("id", data.user_id)
        .select("id, plano, subscription_status, creditos_avulsos")
        .single();
    if (error)
        throw new Error(`Falha ao redefinir plano: ${error.message}`);
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
        supabaseAdmin.from("cobrancas_avulsas").select("valor_cents, status"),
    ]);
    const totalUsuarios = profilesRes.count ?? 0;
    const porPlano = { basico: 0, profissional: 0, expert: 0, sem_plano: 0 };
    for (const row of (profilesRes.data ?? [])) {
        const p = row.plano;
        if (p === "expert")
            porPlano.expert++;
        else if (p === "profissional" || p === "pro")
            porPlano.profissional++;
        else if (p === "basico" || p === "user")
            porPlano.basico++;
        else
            porPlano.sem_plano++;
    }
    const totalLaudos = laudosRes.count ?? 0;
    let receitaCentavos = 0;
    for (const c of (receitaRes.data ?? [])) {
        if (c.status === "paid" || c.status === "succeeded" || c.status === "complete") {
            receitaCentavos += c.valor_cents ?? 0;
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
    .inputValidator((data) => z.object({
    busca: z.string().trim().max(200).optional().default(""),
    limit: z.number().int().min(1).max(200).optional().default(100),
}).parse(data))
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
    if (error)
        throw new Error(`Falha ao listar usuários: ${error.message}`);
    // Enriquecer com e-mail real do auth quando profile.email estiver vazio
    const missingEmail = (rows ?? []).filter((r) => !r.email).map((r) => r.id);
    let authEmails = {};
    if (missingEmail.length) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        for (const u of list?.users ?? []) {
            if (u.email && missingEmail.includes(u.id))
                authEmails[u.id] = u.email;
        }
    }
    return (rows ?? []).map((r) => ({
        id: r.id,
        nome: r.nome,
        email: r.email ?? authEmails[r.id] ?? null,
        plano: r.plano,
        subscription_status: r.subscription_status,
        created_at: r.created_at,
    }));
});
// ============= BETA TESTERS =============
export const listarBetaTesters = createServerFn({ method: "GET" })
    .middleware([requireSupabaseAuth])
    .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, nome, email, beta_plano, beta_expira_em, is_beta_tester")
        .eq("is_beta_tester", true)
        .order("beta_expira_em", { ascending: true });
    if (error)
        throw new Error(`Falha ao listar beta testers: ${error.message}`);
    return data ?? [];
});
export const liberarBetaTester = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((data) => z.object({
    user_id: z.string().uuid(),
    plano: z.enum(PLANO_VALUES),
    expira_em: z.string().min(10), // ISO date or datetime
}).parse(data))
    .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    const expira = new Date(data.expira_em);
    if (isNaN(expira.getTime()))
        throw new Error("Data de expiração inválida");
    if (expira <= new Date())
        throw new Error("A data de expiração deve ser no futuro");
    const { data: updated, error } = await supabaseAdmin
        .from("profiles")
        .update({
        is_beta_tester: true,
        beta_plano: data.plano,
        beta_expira_em: expira.toISOString(),
    })
        .eq("id", data.user_id)
        .select("id, nome, email, beta_plano, beta_expira_em, is_beta_tester")
        .single();
    if (error)
        throw new Error(`Falha ao liberar beta: ${error.message}`);
    console.log("[admin] Beta liberado", {
        admin: context.userId, target: data.user_id, plano: data.plano, expira: expira.toISOString(),
    });
    return { ok: true, profile: updated };
});
export const revogarBetaTester = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((data) => z.object({ user_id: z.string().uuid() }).parse(data))
    .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    const { error } = await supabaseAdmin
        .from("profiles")
        .update({ is_beta_tester: false, beta_plano: null, beta_expira_em: null })
        .eq("id", data.user_id);
    if (error)
        throw new Error(`Falha ao revogar beta: ${error.message}`);
    console.log("[admin] Beta revogado", { admin: context.userId, target: data.user_id });
    return { ok: true };
});
