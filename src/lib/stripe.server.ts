// Helpers Stripe — chamadas REST via fetch (compatível com Worker runtime).
// Apenas para uso em servidor (handlers de server fns e rotas API).

const STRIPE_API = "https://api.stripe.com/v1";

function getSecret() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurada");
  return key;
}

function encodeForm(obj: Record<string, any>, prefix = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "object") parts.push(encodeForm(item, `${key}[${i}]`));
        else parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === "object") {
      parts.push(encodeForm(v, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join("&");
}

export async function stripeRequest(method: string, path: string, body?: Record<string, any>) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getSecret()}`,
  };
  let init: RequestInit = { method, headers };
  if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = encodeForm(body);
  }
  const res = await fetch(`${STRIPE_API}${path}`, init);
  const json: any = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${path}: ${json?.error?.message ?? res.statusText}`);
  }
  return json;
}

export const PLANS = {
  basico: {
    code: "basico",
    name: "Plano Básico — Laudo Avulso",
    price_cents: 15700,
    lookup_key: "a8_basico_unit_v2",
    description: "1 laudo por compra (pagamento único)",
    db_plan: "basico" as const,
    mode: "payment" as const,
    limit: 1,
  },
  profissional: {
    code: "profissional",
    name: "Plano Profissional",
    price_cents: 22900,
    lookup_key: "a8_profissional_monthly_v2",
    description: "5 laudos por mês",
    db_plan: "profissional" as const,
    mode: "subscription" as const,
    limit: 5,
  },
  expert: {
    code: "expert",
    name: "Plano Expert",
    price_cents: 37700,
    lookup_key: "a8_expert_monthly_v2",
    description: "Laudos ilimitados + NBR 14653-2",
    db_plan: "expert" as const,
    mode: "subscription" as const,
    limit: null as number | null,
  },
} as const;

export type PlanCode = keyof typeof PLANS;

/**
 * Garante que o Price existe no Stripe (busca por lookup_key, cria se necessário).
 * Retorna o price_id.
 */
export async function ensurePrice(plan: (typeof PLANS)[PlanCode]): Promise<string> {
  // Busca por lookup_key
  const list = await stripeRequest(
    "GET",
    `/prices?lookup_keys[]=${encodeURIComponent(plan.lookup_key)}&active=true&limit=1&expand[]=data.product`,
  );
  if (list.data?.length > 0) return list.data[0].id;

  // Cria produto + price
  const product = await stripeRequest("POST", "/products", {
    name: plan.name,
    description: plan.description,
  });

  const priceBody: Record<string, any> = {
    product: product.id,
    unit_amount: plan.price_cents,
    currency: "brl",
    lookup_key: plan.lookup_key,
  };
  if (plan.mode === "subscription") {
    priceBody.recurring = { interval: "month" };
  }

  const price = await stripeRequest("POST", "/prices", priceBody);

  return price.id;
}
