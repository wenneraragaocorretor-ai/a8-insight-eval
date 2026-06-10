import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";

export const criarCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      plano: z.enum(["basico", "profissional", "expert"]),
      origin: z.string().url(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { PLANS, ensurePrice, stripeRequest } = await import("./stripe.server");
    const { supabase, userId } = context;

    const plan = PLANS[data.plano];
    const priceId = await ensurePrice(plan);

    // Garante profile + stripe_customer_id (upsert cria a linha se faltar)
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, nome")
      .eq("id", userId)
      .maybeSingle();

    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    const nome =
      profile?.nome ||
      (userData.user?.user_metadata as any)?.nome ||
      email?.split("@")[0] ||
      "Usuário";

    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripeRequest("POST", "/customers", {
        email,
        name: nome,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
    }

    await supabase
      .from("profiles")
      .upsert({ id: userId, nome, stripe_customer_id: customerId }, { onConflict: "id" });

    const sessionBody: Record<string, any> = {
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
    } else {
      sessionBody["payment_intent_data[metadata][user_id]"] = userId;
      sessionBody["payment_intent_data[metadata][plan_code]"] = data.plano;
    }

    const session = await stripeRequest("POST", "/checkout/sessions", sessionBody);

    return { url: session.url as string };
  });

export const getStatusAssinatura = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("plano, subscription_status, subscription_current_period_end, plan_price_id, creditos_avulsos")
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

    const plano = (profile?.plano ?? "basico") as "basico" | "profissional" | "expert" | "user" | "pro";
    let limite: number | null;
    if (plano === "expert") limite = null;
    else if (plano === "profissional" || plano === "pro") limite = 5;
    else limite = 1; // básico: laudo avulso
    const ativa = profile?.subscription_status === "active" || profile?.subscription_status === "trialing";

    return {
      plano,
      assinaturaAtiva: ativa,
      statusAssinatura: profile?.subscription_status ?? null,
      proximoCiclo: profile?.subscription_current_period_end ?? null,
      avaliacoesMes: count ?? 0,
      limiteMes: limite,
      creditosAvulsos: profile?.creditos_avulsos ?? 0,
    };
  });

export const confirmarCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ session_id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    // Fallback caso o webhook ainda não tenha sido entregue (ex.: ambiente dev sem webhook).
    const { stripeRequest, PLANS } = await import("./stripe.server");
    const { supabase, userId } = context;

    const session = await stripeRequest(
      "GET",
      `/checkout/sessions/${encodeURIComponent(data.session_id)}?expand[]=subscription`,
    );
    if (session.metadata?.user_id && session.metadata.user_id !== userId) {
      throw new Error("Sessão de checkout não pertence ao usuário atual");
    }
    if (!session.subscription) return { ok: false };

    const sub = typeof session.subscription === "string"
      ? await stripeRequest("GET", `/subscriptions/${session.subscription}`)
      : session.subscription;

    const priceId = sub.items?.data?.[0]?.price?.id as string | undefined;
    let planCode = session.metadata?.plan_code as keyof typeof PLANS | undefined;

    if (priceId) {
      const price = await stripeRequest("GET", `/prices/${encodeURIComponent(priceId)}`);
      const lookupKey = price.lookup_key as string | undefined;
      const byLookup = Object.values(PLANS).find((plan) => plan.lookup_key === lookupKey);
      if (byLookup) planCode = byLookup.code as keyof typeof PLANS;
    }

    if (!planCode || !PLANS[planCode]) {
      throw new Error("Não foi possível identificar o plano comprado no checkout");
    }

    const dbPlan = PLANS[planCode].db_plan;

    // Busca nome existente (necessário para upsert pois é NOT NULL)
    const { data: existing } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", userId)
      .maybeSingle();
    const { data: userData } = await supabase.auth.getUser();
    const nome =
      existing?.nome ||
      (userData.user?.user_metadata as any)?.nome ||
      userData.user?.email?.split("@")[0] ||
      "Usuário";

    const { data: updatedProfile, error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        nome,
        plano: dbPlan as any,
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
        subscription_current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        plan_price_id: priceId ?? null,
        stripe_customer_id: sub.customer,
      },
      { onConflict: "id" },
    ).select("plano, subscription_status, plan_price_id").single();

    if (error) throw new Error(`Falha ao atualizar plano no perfil: ${error.message}`);
    console.log("[confirmarCheckout] Perfil atualizado com sucesso", {
      userId,
      sessionId: data.session_id,
      plano: updatedProfile?.plano,
      priceId: updatedProfile?.plan_price_id,
    });

    return { ok: true, plano: dbPlan };
  });
