import { createFileRoute } from "@tanstack/react-router";

// Webhook do Stripe. Atualiza o perfil do usuário quando a assinatura é criada,
// atualizada ou cancelada. Verifica assinatura via STRIPE_WEBHOOK_SECRET.

async function verifyStripeSignature(payload: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    }),
  );
  const timestamp = parts["t"];
  const v1 = parts["v1"];
  if (!timestamp || !v1) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`));
  const hex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

const PLAN_BY_PRICE_LOOKUP: Record<string, "basico" | "profissional" | "expert"> = {
  a8_basico_unit_v2: "basico",
  a8_profissional_monthly_v2: "profissional",
  a8_expert_monthly_v2: "expert",
  // legados (compat)
  a8_basico_monthly: "basico",
  a8_profissional_monthly: "profissional",
  a8_expert_monthly: "expert",
};

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = await request.text();
        const sig = request.headers.get("stripe-signature");
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (webhookSecret) {
          const ok = await verifyStripeSignature(payload, sig, webhookSecret);
          if (!ok) return new Response("Invalid signature", { status: 401 });
        } else {
          console.warn("STRIPE_WEBHOOK_SECRET ausente — webhook aceito sem verificação (apenas dev).");
        }

        const event = JSON.parse(payload);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { stripeRequest, PLANS } = await import("@/lib/stripe.server");

        async function applySubscription(sub: any, session?: any) {
          const userId = sub.metadata?.user_id ?? session?.metadata?.user_id;
          if (!userId) {
            console.warn("Subscription sem metadata.user_id", sub.id);
            return;
          }
          let plano: "basico" | "profissional" | "expert" | null = null;
          const planCode = (sub.metadata?.plan_code ?? session?.metadata?.plan_code) as string | undefined;
          if (planCode === "basico") plano = "basico";
          else if (planCode === "profissional") plano = "profissional";
          else if (planCode === "expert") plano = "expert";

          if (!plano) {
            const priceId = sub.items?.data?.[0]?.price?.id;
            if (priceId) {
              const price = await stripeRequest("GET", `/prices/${priceId}`);
              const lookup = price.lookup_key as string | undefined;
              if (lookup && PLAN_BY_PRICE_LOOKUP[lookup]) plano = PLAN_BY_PRICE_LOOKUP[lookup];
            }
          }

          const isActive = sub.status === "active" || sub.status === "trialing";
          const { data: existing } = await supabaseAdmin
            .from("profiles")
            .select("nome")
            .eq("id", userId)
            .maybeSingle();
          const nome = existing?.nome || session?.customer_details?.name || session?.customer_details?.email?.split("@")[0] || "Usuário";

          const { data: updatedProfile, error } = await supabaseAdmin.from("profiles").upsert({
            id: userId,
            nome,
            plano: (isActive ? plano ?? "basico" : "basico") as any,
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer,
            subscription_status: sub.status,
            subscription_current_period_end: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
            plan_price_id: sub.items?.data?.[0]?.price?.id ?? null,
          }, { onConflict: "id" }).select("plano, subscription_status, plan_price_id").single();

          if (error) throw error;
          console.log("[stripe-webhook] Perfil atualizado com sucesso", {
            userId,
            subscriptionId: sub.id,
            plano: updatedProfile?.plano,
            planoDetectado: Object.values(PLANS).find((plan) => plan.db_plan === updatedProfile?.plano)?.code,
            priceId: updatedProfile?.plan_price_id,
          });
        }

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object;
              if (session.subscription) {
                const sub = await stripeRequest("GET", `/subscriptions/${session.subscription}`);
                if (!sub.metadata?.user_id && session.metadata?.user_id) {
                  sub.metadata = { ...sub.metadata, ...session.metadata };
                }
                await applySubscription(sub, session);
              } else if (session.mode === "payment" && session.payment_status === "paid") {
                // Pagamento único — Básico (laudo avulso) ou Expert Extra: +1 crédito
                const userId = session.metadata?.user_id;
                const planCode = session.metadata?.plan_code;
                if (userId) {
                  const { data: existing } = await supabaseAdmin
                    .from("profiles")
                    .select("nome, creditos_avulsos, plano")
                    .eq("id", userId)
                    .maybeSingle();
                  const nome = existing?.nome || session.customer_details?.name || session.customer_details?.email?.split("@")[0] || "Usuário";
                  const novosCreditos = (existing?.creditos_avulsos ?? 0) + 1;
                  const upsertData: any = {
                    id: userId,
                    nome,
                    creditos_avulsos: novosCreditos,
                    stripe_customer_id: session.customer ?? null,
                  };
                  // Só vira plano "basico" se for compra de laudo Básico.
                  // Para "expert_extra", preserva o plano atual (Expert).
                  if (planCode === "basico") upsertData.plano = "basico";
                  const { error } = await supabaseAdmin.from("profiles").upsert(upsertData, { onConflict: "id" });
                  if (error) throw error;
                  console.log("[stripe-webhook] +1 crédito", { userId, planCode, novosCreditos });

                  // Registra no histórico de cobranças avulsas (idempotente via unique session_id)
                  const valorCents = typeof session.amount_total === "number"
                    ? session.amount_total
                    : (planCode === "expert_extra" ? 1200 : 15700);
                  const tipo = planCode === "expert_extra" ? "expert_extra" : "basico_laudo";
                  const descricao = planCode === "expert_extra"
                    ? "Laudo adicional Expert"
                    : "Laudo avulso Básico";
                  await supabaseAdmin.from("cobrancas_avulsas").upsert({
                    user_id: userId,
                    tipo,
                    valor_cents: valorCents,
                    moeda: session.currency ?? "brl",
                    stripe_session_id: session.id,
                    stripe_payment_intent: (typeof session.payment_intent === "string" ? session.payment_intent : null),
                    status: "paid",
                    descricao,
                  }, { onConflict: "stripe_session_id" });
                }
              }
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
              await applySubscription(event.data.object);
              break;
            }
          }
        } catch (e: any) {
          console.error("Erro processando webhook:", e?.message ?? e);
          return new Response("error", { status: 500 });
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
