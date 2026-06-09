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

    // Garante stripe_customer_id no profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, nome")
      .eq("id", userId)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      const customer = await stripeRequest("POST", "/customers", {
        email,
        name: profile?.nome ?? undefined,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
    }

    const session = await stripeRequest("POST", "/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": 1,
      success_url: `${data.origin}/dashboard?pagamento=sucesso&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/planos?canceled=1`,
      "metadata[user_id]": userId,
      "metadata[plan_code]": data.plano,
      "subscription_data[metadata][user_id]": userId,
      "subscription_data[metadata][plan_code]": data.plano,
      allow_promotion_codes: "true",
    });

    return { url: session.url as string };
  });

export const getStatusAssinatura = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("plano, subscription_status, subscription_current_period_end, plan_price_id")
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

    const plano = (profile?.plano ?? "user") as "user" | "pro" | "expert";
    const limite = plano === "user" ? 3 : null;
    const ativa = profile?.subscription_status === "active" || profile?.subscription_status === "trialing";

    return {
      plano,
      assinaturaAtiva: ativa,
      statusAssinatura: profile?.subscription_status ?? null,
      proximoCiclo: profile?.subscription_current_period_end ?? null,
      avaliacoesMes: count ?? 0,
      limiteMes: limite,
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

    const planCode = (session.metadata?.plan_code ?? "basico") as keyof typeof PLANS;
    const dbPlan = PLANS[planCode]?.db_plan ?? "user";

    await supabase.from("profiles").update({
      plano: dbPlan,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      subscription_current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      plan_price_id: sub.items?.data?.[0]?.price?.id ?? null,
      stripe_customer_id: sub.customer,
    }).eq("id", userId);

    return { ok: true, plano: dbPlan };
  });
