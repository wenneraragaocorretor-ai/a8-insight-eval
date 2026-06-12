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
