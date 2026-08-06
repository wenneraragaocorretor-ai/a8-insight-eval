import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";
async function userIsAdmin(supabase, userId) {
    const { data, error } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
    if (error)
        throw new Error(`Falha ao verificar admin: ${error.message}`);
    return !!data;
}
export const criarCheckoutSession = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((data) => z.object({
    plano: z.enum(["basico", "profissional", "expert", "expert_extra"]),
    origin: z.string().url(),
}).parse(data))
    .handler(async ({ data, context }) => {
    const { PLANS, ensurePrice, listConfiguredStripePrices, stripeRequest } = await import("./stripe.server");
    const { supabase, userId } = context;
    console.log("[checkout] === INÍCIO ===", { userId, plano: data.plano, origin: data.origin });
    const plan = PLANS[data.plano];
    console.log("[checkout] Plano recebido:", {
        code: plan.code, lookup_key: plan.lookup_key, price_cents: plan.price_cents, mode: plan.mode,
    });
    let priceId;
    try {
        priceId = await ensurePrice(plan);
        console.log("[checkout] Price ID resolvido:", priceId);
    }
    catch (e) {
        console.error("[checkout] FALHA em ensurePrice:", e?.message ?? e);
        throw e;
    }
    try {
        const configuredPrices = await listConfiguredStripePrices();
        console.log("[checkout] Price IDs configurados no Stripe:", configuredPrices);
    }
    catch (e) {
        console.error("[checkout] Falha ao listar prices (ignorando):", e?.message ?? e);
    }
    // Garante profile + stripe_customer_id (upsert cria a linha se faltar)
    const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_customer_id, nome")
        .eq("id", userId)
        .maybeSingle();
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    const nome = profile?.nome ||
        userData.user?.user_metadata?.nome ||
        email?.split("@")[0] ||
        "Usuário";
    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
        try {
            const customer = await stripeRequest("POST", "/customers", {
                email, name: nome, metadata: { user_id: userId },
            });
            customerId = customer.id;
            console.log("[checkout] Customer Stripe criado:", customerId);
        }
        catch (e) {
            console.error("[checkout] FALHA ao criar customer:", e?.message ?? e);
            throw e;
        }
    }
    else {
        console.log("[checkout] Customer Stripe existente:", customerId);
    }
    await supabase
        .from("profiles")
        .upsert({ id: userId, nome, stripe_customer_id: customerId }, { onConflict: "id" });
    const sessionBody = {
        mode: plan.mode,
        customer: customerId,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": 1,
        success_url: `${data.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}&pagamento=ok`,
        cancel_url: `${data.origin}/planos?canceled=1`,
        "metadata[user_id]": userId,
        "metadata[plan_code]": data.plano,
        allow_promotion_codes: "true",
    };
    if (plan.mode === "subscription") {
        sessionBody["subscription_data[metadata][user_id]"] = userId;
        sessionBody["subscription_data[metadata][plan_code]"] = data.plano;
    }
    else {
        sessionBody["payment_intent_data[metadata][user_id]"] = userId;
        sessionBody["payment_intent_data[metadata][plan_code]"] = data.plano;
    }
    let session;
    try {
        session = await stripeRequest("POST", "/checkout/sessions", sessionBody);
        console.log("[checkout] ✅ Sessão criada:", {
            id: session.id, url: session.url, mode: session.mode,
            status: session.status, customer: session.customer, livemode: session.livemode,
        });
    }
    catch (e) {
        console.error("[checkout] ❌ FALHA ao criar sessão Stripe:", {
            message: e?.message ?? String(e), priceId, customerId, plano: data.plano,
        });
        throw e;
    }
    return { url: session.url, priceId, plano: data.plano, sessionId: session.id };
});
export const getStatusAssinatura = createServerFn({ method: "GET" })
    .middleware([requireSupabaseAuth])
    .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Admins têm acesso completo (Expert ilimitado), sem necessidade de assinatura.
    const isAdmin = await userIsAdmin(supabase, userId);
    if (isAdmin) {
        return {
            plano: "expert",
            assinaturaAtiva: true,
            statusAssinatura: "admin",
            proximoCiclo: null,
            avaliacoesMes: 0,
            limiteMes: null,
            creditosAvulsos: 0,
            isAdmin: true,
            isBetaTester: false,
            betaExpiraEm: null,
        };
    }
    const { data: profile } = await supabase
        .from("profiles")
        .select("plano, subscription_status, subscription_current_period_end, plan_price_id, creditos_avulsos, is_beta_tester, beta_plano, beta_expira_em")
        .eq("id", userId)
        .maybeSingle();
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const { count } = await supabase
        .from("avaliacoes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", inicioMes.toISOString());
    // ---- BETA TESTER: acesso liberado e completo ao beta_plano até a data definida ----
    const agora = new Date();
    const betaAtivo = !!profile?.is_beta_tester &&
        !!profile?.beta_plano &&
        !!profile?.beta_expira_em &&
        new Date(profile.beta_expira_em) > agora;
    if (betaAtivo) {
        const bp = profile.beta_plano;
        const limBeta = bp === "expert" ? 20 : bp === "profissional" ? 8 : 1;
        return {
            plano: bp,
            assinaturaAtiva: true,
            statusAssinatura: "beta",
            proximoCiclo: profile.beta_expira_em,
            avaliacoesMes: count ?? 0,
            limiteMes: limBeta,
            creditosAvulsos: bp === "basico" ? Math.max(1, profile?.creditos_avulsos ?? 0) : (profile?.creditos_avulsos ?? 0),
            isAdmin: false,
            isBetaTester: true,
            betaExpiraEm: profile.beta_expira_em,
        };
    }
    const plano = (profile?.plano ?? null);
    let limite;
    if (plano === "expert")
        limite = 20;
    else if (plano === "profissional" || plano === "pro")
        limite = 8;
    else if (plano === "basico")
        limite = 1;
    else
        limite = 0; // sem plano: sem acesso
    const ativa = profile?.subscription_status === "active" || profile?.subscription_status === "trialing";
    return {
        plano,
        assinaturaAtiva: ativa,
        statusAssinatura: profile?.subscription_status ?? null,
        proximoCiclo: profile?.subscription_current_period_end ?? null,
        avaliacoesMes: count ?? 0,
        limiteMes: limite,
        creditosAvulsos: profile?.creditos_avulsos ?? 0,
        isAdmin: false,
        isBetaTester: false,
        betaExpiraEm: null,
    };
});
export const confirmarCheckout = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((data) => z.object({ session_id: z.string() }).parse(data))
    .handler(async ({ data, context }) => {
    // Fallback caso o webhook ainda não tenha sido entregue (ex.: ambiente dev sem webhook).
    const { stripeRequest, PLANS, resolvePlanCodeFromPriceId } = await import("./stripe.server");
    // IMPORTANTE: usar supabaseAdmin para escrever em `profiles` — o trigger
    // `protect_billing_columns` rejeita updates de plano/subscription quando
    // o role é `authenticated`. Só o service_role consegue sobrescrever.
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    const { supabase, userId } = context;
    const session = await stripeRequest("GET", `/checkout/sessions/${encodeURIComponent(data.session_id)}?expand[]=subscription&expand[]=line_items.data.price`);
    if (session.metadata?.user_id && session.metadata.user_id !== userId) {
        throw new Error("Sessão de checkout não pertence ao usuário atual");
    }
    // Identifica plano priorizando o Price ID real do Stripe. SEM fallback para "basico".
    let planCode = null;
    const lineItemPriceId = session.line_items?.data?.[0]?.price?.id;
    if (lineItemPriceId) {
        planCode = (await resolvePlanCodeFromPriceId(lineItemPriceId));
    }
    if (!planCode) {
        const metaPlan = session.metadata?.plan_code;
        if (metaPlan && PLANS[metaPlan])
            planCode = metaPlan;
    }
    console.log("[confirmarCheckout] Price ID selecionado:", lineItemPriceId ?? null);
    console.log("[confirmarCheckout] Plano mapeado:", planCode);
    if (!planCode || !PLANS[planCode]) {
        console.error("[confirmarCheckout] Price ID não reconhecido — NÃO atribuindo plano", {
            sessionId: session.id,
            priceId: lineItemPriceId ?? null,
            metadataPlanCode: session.metadata?.plan_code ?? null,
        });
        throw new Error("Não foi possível identificar o plano pago. Entre em contato com o suporte.");
    }
    const plan = PLANS[planCode];
    // Busca estado atual (necessário para upsert: `nome` é NOT NULL; logs de debug)
    const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("nome, plano, subscription_status, stripe_subscription_id, creditos_avulsos")
        .eq("id", userId)
        .maybeSingle();
    const { data: userData } = await supabase.auth.getUser();
    const nome = existing?.nome ||
        userData.user?.user_metadata?.nome ||
        userData.user?.email?.split("@")[0] ||
        "Usuário";
    console.log("[confirmarCheckout] Plano atual no perfil:", {
        userId,
        planoAtual: existing?.plano ?? null,
        statusAtual: existing?.subscription_status ?? null,
        subAtual: existing?.stripe_subscription_id ?? null,
        novoPlanCode: planCode,
    });
    // ---- BÁSICO ou EXPERT_EXTRA: pagamento único, soma 1 crédito de laudo avulso ----
    if (plan.mode === "payment") {
        if (session.payment_status !== "paid")
            return { ok: false };
        // Idempotência: se já existe cobrança registrada para este session_id,
        // não credita de novo (previne replay attack via reuso de session_id).
        const { data: existingCharge } = await supabaseAdmin
            .from("cobrancas_avulsas")
            .select("id")
            .eq("stripe_session_id", session.id)
            .maybeSingle();
        if (existingCharge) {
            return { ok: true, plano: planCode, creditosAvulsos: existing?.creditos_avulsos ?? 0, alreadyProcessed: true };
        }
        // Registra cobrança PRIMEIRO (unique constraint em stripe_session_id é a barreira atômica).
        const valorCents = typeof session.amount_total === "number"
            ? session.amount_total
            : plan.price_cents;
        const { error: cobrancaError } = await supabaseAdmin.from("cobrancas_avulsas").insert({
            user_id: userId,
            tipo: planCode === "expert_extra" ? "expert_extra" : "basico_laudo",
            valor_cents: valorCents,
            moeda: session.currency ?? "brl",
            stripe_session_id: session.id,
            stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
            status: "paid",
            descricao: planCode === "expert_extra" ? "Laudo adicional Expert" : "Laudo avulso Básico",
        });
        if (cobrancaError) {
            if (cobrancaError.code === "23505") {
                return { ok: true, plano: planCode, creditosAvulsos: existing?.creditos_avulsos ?? 0, alreadyProcessed: true };
            }
            throw new Error(`Falha ao registrar cobrança: ${cobrancaError.message}`);
        }
        const novosCreditos = (existing?.creditos_avulsos ?? 0) + 1;
        const upsertData = {
            id: userId,
            nome,
            creditos_avulsos: novosCreditos,
            stripe_customer_id: session.customer ?? undefined,
        };
        if (planCode === "basico") {
            upsertData.plano = "basico";
            upsertData.subscription_status = null;
            upsertData.stripe_subscription_id = null;
            upsertData.plan_price_id = null;
            upsertData.subscription_current_period_end = null;
        }
        else if (planCode === "expert_extra") {
            upsertData.plano = "expert";
        }
        const { data: updRow, error } = await supabaseAdmin
            .from("profiles")
            .upsert(upsertData, { onConflict: "id" })
            .select("plano, creditos_avulsos")
            .single();
        if (error)
            throw new Error(`Falha ao creditar laudo: ${error.message}`);
        console.log("[confirmarCheckout] ✅ Avulso aplicado:", updRow);
        return { ok: true, plano: planCode, creditosAvulsos: novosCreditos };
    }
    // ---- PROFISSIONAL/EXPERT: assinatura recorrente ----
    if (!session.subscription)
        return { ok: false };
    const sub = typeof session.subscription === "string"
        ? await stripeRequest("GET", `/subscriptions/${session.subscription}`)
        : session.subscription;
    const priceId = sub.items?.data?.[0]?.price?.id;
    const dbPlan = plan.db_plan;
    // SEMPRE sobrescreve o plano com o produto recém-comprado (upgrade/downgrade).
    const { data: updatedProfile, error } = await supabaseAdmin.from("profiles").upsert({
        id: userId,
        nome,
        plano: dbPlan,
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
        subscription_current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        plan_price_id: priceId ?? null,
        stripe_customer_id: sub.customer,
    }, { onConflict: "id" }).select("plano, subscription_status, plan_price_id, stripe_subscription_id").single();
    if (error) {
        console.error("[confirmarCheckout] ❌ Falha ao atualizar perfil:", error);
        throw new Error(`Falha ao atualizar plano no perfil: ${error.message}`);
    }
    console.log("[confirmarCheckout] ✅ Perfil atualizado", {
        userId,
        sessionId: data.session_id,
        planoAntes: existing?.plano ?? null,
        planoDepois: updatedProfile?.plano,
        subId: updatedProfile?.stripe_subscription_id,
        priceId: updatedProfile?.plan_price_id,
    });
    return { ok: true, plano: dbPlan };
});
export const listarCobrancasAvulsas = createServerFn({ method: "GET" })
    .middleware([requireSupabaseAuth])
    .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
        .from("cobrancas_avulsas")
        .select("id, tipo, valor_cents, moeda, status, descricao, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
    if (error)
        throw new Error(error.message);
    return data ?? [];
});
