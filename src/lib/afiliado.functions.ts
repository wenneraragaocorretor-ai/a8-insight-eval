import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";

function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  if (!domain) return "—";
  const visible = user.slice(0, 1);
  return `${visible}***@${domain}`;
}

export const amIAfiliado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "afiliado")
      .maybeSingle();
    if (error) throw new Error(`Falha ao verificar afiliado: ${error.message}`);
    return { afiliado: !!data };
  });

export const getAfiliadoDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Checagem de role
    const { data: roleRow, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "afiliado")
      .maybeSingle();
    if (roleErr) throw new Error(`Falha ao verificar acesso: ${roleErr.message}`);
    if (!roleRow) throw new Error("Acesso negado: esta conta não possui acesso de afiliado.");

    // Dados do próprio afiliado — RLS garante que vê só o próprio registro
    const { data: afiliado, error: afErr } = await context.supabase
      .from("afiliados")
      .select("id, nome, email, codigo, percentual_comissao, ativo")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (afErr) throw new Error(`Falha ao buscar afiliado: ${afErr.message}`);
    if (!afiliado) throw new Error("Cadastro de afiliado não encontrado.");

    // Indicações — RLS filtra por afiliado_id
    const { data: indicacoes, error: indErr } = await context.supabase
      .from("indicacoes_afiliado")
      .select("id, usuario_indicado_id, plano, valor_pago, valor_comissao, status, created_at, pago_em")
      .eq("afiliado_id", afiliado.id)
      .order("created_at", { ascending: false });
    if (indErr) throw new Error(`Falha ao buscar indicações: ${indErr.message}`);

    // E-mails dos indicados (mascarados) — exige admin para ler auth.users
    const userIds = (indicacoes ?? []).map((i) => i.usuario_indicado_id);
    const emailMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { supabaseAdmin } = await import("../integrations/supabase/client.server");
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      for (const p of profs ?? []) {
        if (p.email) emailMap[p.id] = p.email;
      }
      // Fallback via auth.admin para perfis sem email
      const missing = userIds.filter((id) => !emailMap[id]);
      if (missing.length) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        for (const u of list?.users ?? []) {
          if (u.email && missing.includes(u.id)) emailMap[u.id] = u.email;
        }
      }
    }

    return {
      afiliado: {
        id: afiliado.id,
        nome: afiliado.nome,
        codigo: afiliado.codigo,
        percentual_comissao: Number(afiliado.percentual_comissao),
        ativo: afiliado.ativo,
      },
      indicacoes: (indicacoes ?? []).map((i) => ({
        id: i.id,
        plano: i.plano,
        valor_pago: Number(i.valor_pago),
        valor_comissao: Number(i.valor_comissao),
        status: i.status,
        created_at: i.created_at,
        pago_em: i.pago_em,
        email_mascarado: maskEmail(emailMap[i.usuario_indicado_id]),
      })),
    };
  });
