// Helpers Stripe — chamadas REST via fetch (compatível com Worker runtime).
// Apenas para uso em servidor (handlers de server fns e rotas API).
const STRIPE_API = "https://api.stripe.com/v1";
function getSecret() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key)
        throw new Error("STRIPE_SECRET_KEY não configurada");
    return key;
}
function encodeForm(obj, prefix = "") {
    const parts = [];
    for (const [k, v] of Object.entries(obj)) {
        if (v === undefined || v === null)
            continue;
        const key = prefix ? `${prefix}[${k}]` : k;
        if (Array.isArray(v)) {
            v.forEach((item, i) => {
                if (typeof item === "object")
                    parts.push(encodeForm(item, `${key}[${i}]`));
                else
                    parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
            });
        }
        else if (typeof v === "object") {
            parts.push(encodeForm(v, key));
        }
        else {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
        }
    }
    return parts.join("&");
}
export async function stripeRequest(method, path, body) {
    const headers = {
        Authorization: `Bearer ${getSecret()}`,
    };
    let init = { method, headers };
    if (body) {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        init.body = encodeForm(body);
    }
    const res = await fetch(`${STRIPE_API}${path}`, init);
    const json = await res.json();
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
        db_plan: "basico",
        mode: "payment",
        limit: 1,
    },
    profissional: {
        code: "profissional",
        name: "Plano Profissional",
        price_cents: 24900,
        lookup_key: "a8_profissional_monthly_v3",
        description: "8 laudos por mês",
        db_plan: "profissional",
        mode: "subscription",
        limit: 5,
    },
    expert: {
        code: "expert",
        name: "Plano Expert",
        price_cents: 37700,
        lookup_key: "a8_expert_monthly_v2",
        description: "20 laudos por mês + NBR 14653-2",
        db_plan: "expert",
        mode: "subscription",
        limit: 20,
    },
    expert_extra: {
        code: "expert_extra",
        name: "Laudo Extra Expert",
        price_cents: 1200,
        lookup_key: "a8_expert_extra_unit_v1",
        description: "1 laudo adicional do Plano Expert (pagamento único)",
        db_plan: "expert",
        mode: "payment",
        limit: 1,
    },
};
// Price IDs reais verificados no Stripe. O lookup_key continua sendo usado como
// fallback para evitar quebra se um Price for recriado mantendo a chave do plano.
export const PLAN_CODE_BY_PRICE_ID = {
    price_1ThAwUHzSV1FTjCx7DRWppdV: "basico",
    price_1ThJqPHzSV1FTjCxcYZUuZv2: "profissional",
    price_1ThUIUHzSV1FTjCx4uIZvRri: "expert",
    price_1ThUzXHzSV1FTjCxFPabAje0: "expert_extra",
};
const LEGACY_PLAN_CODE_BY_LOOKUP = {
    a8_basico_monthly: "basico",
    a8_profissional_monthly: "profissional",
    a8_profissional_monthly_v2: "profissional",
    a8_expert_monthly: "expert",
};
export async function resolvePlanCodeFromPriceId(priceId) {
    if (!priceId)
        return null;
    const known = PLAN_CODE_BY_PRICE_ID[priceId];
    if (known)
        return known;
    const price = await stripeRequest("GET", `/prices/${encodeURIComponent(priceId)}`);
    const lookupKey = price.lookup_key;
    const byLookup = Object.values(PLANS).find((plan) => plan.lookup_key === lookupKey);
    return byLookup?.code ?? (lookupKey ? LEGACY_PLAN_CODE_BY_LOOKUP[lookupKey] : undefined) ?? null;
}
export async function listConfiguredStripePrices() {
    const entries = await Promise.all(Object.entries(PLANS).map(async ([code, plan]) => {
        const list = await stripeRequest("GET", `/prices?lookup_keys[]=${encodeURIComponent(plan.lookup_key)}&active=true&limit=1&expand[]=data.product`);
        const price = list.data?.[0];
        return [code, {
                lookup_key: plan.lookup_key,
                price_id: price?.id ?? null,
                valor_centavos: price?.unit_amount ?? null,
                tipo: price?.recurring ? "subscription" : "payment",
                plano_banco: plan.db_plan,
            }];
    }));
    return Object.fromEntries(entries);
}
/**
 * Garante que o Price existe no Stripe (busca por lookup_key, cria se necessário).
 * Retorna o price_id.
 */
export async function ensurePrice(plan) {
    // Busca por lookup_key
    const list = await stripeRequest("GET", `/prices?lookup_keys[]=${encodeURIComponent(plan.lookup_key)}&active=true&limit=1&expand[]=data.product`);
    const existing = list.data?.[0];
    // Valida que o price ativo corresponde EXATAMENTE ao plano (amount + mode + currency).
    // Se algum price antigo ficou associado ao lookup_key com valor errado, recria.
    if (existing) {
        const amountOk = existing.unit_amount === plan.price_cents;
        const currencyOk = existing.currency === "brl";
        const modeOk = plan.mode === "subscription"
            ? existing.recurring?.interval === "month"
            : existing.recurring == null;
        if (amountOk && currencyOk && modeOk)
            return existing.id;
        // Mismatch: desativa price antigo e cria um novo transferindo o lookup_key.
        await stripeRequest("POST", `/prices/${existing.id}`, { active: false });
        const productId = typeof existing.product === "string" ? existing.product : existing.product?.id;
        const newPriceBody = {
            product: productId,
            unit_amount: plan.price_cents,
            currency: "brl",
            lookup_key: plan.lookup_key,
            transfer_lookup_key: "true",
        };
        if (plan.mode === "subscription")
            newPriceBody.recurring = { interval: "month" };
        const newPrice = await stripeRequest("POST", "/prices", newPriceBody);
        return newPrice.id;
    }
    // Cria produto + price
    const product = await stripeRequest("POST", "/products", {
        name: plan.name,
        description: plan.description,
    });
    const priceBody = {
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
