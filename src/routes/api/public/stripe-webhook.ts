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

const PLAN_BY_PRICE_LOOKUP: Record<string, "user" | "pro" | "expert"> = {
  a8_basico_monthly: "user",
  a8_profissional_monthly: "pro",
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
        const { stripeRequest } = await import("@/lib/stripe.server");

        async function applySubscription(sub: any) {
          const userId = sub.metadata?.user_id;
          if (!userId) {
            console.warn("Subscription sem metadata.user_id", sub.id);
            return;
          }
          let plano: "user" | "pro" | "expert" | null = null;
          const planCode = sub.metadata?.plan_code as string | undefined;
          if (planCode === "basico") plano = "user";
          else if (planCode === "profissional") plano = "pro";
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

          await supabaseAdmin.from("profiles").update({
            plano: isActive ? plano ?? "user" : "user",
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer,
            subscription_status: sub.status,
            subscription_current_period_end: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
            plan_price_id: sub.items?.data?.[0]?.price?.id ?? null,
          }).eq("id", userId);
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
                await applySubscription(sub);
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
