import { supabase } from "@/integrations/supabase/client";

export async function testIdempotency() {
  const correlationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();

  console.log(`[TEST] Starting idempotency test. correlationId=${correlationId}`);

  const payload = {
    data: {
      idempotencyKey,
      correlationId,
      imovel: {
        tipo: "Apartamento",
        logradouro: "Rua Teste",
        numero: "123",
        bairro: "Centro",
        cidade: "São Paulo",
        estado: "SP",
        area_privativa: 50,
      },
      comparaveis: [
        { valor: 500000, areaPrivativa: 50, quartos: 2, vagas: 1, logradouro: "Rua A" },
        { valor: 520000, areaPrivativa: 52, quartos: 2, vagas: 1, logradouro: "Rua B" },
      ],
    },
  };

  try {
    // Attempt 1
    console.log("[TEST] Sending Attempt 1...");
    const p1 = supabase.functions.invoke("gerar-avaliacao", { body: payload.data });

    // Attempt 2 (Simultaneous)
    console.log("[TEST] Sending Attempt 2 (Duplicate)...");
    const p2 = supabase.functions.invoke("gerar-avaliacao", { body: payload.data });

    const [r1, r2] = await Promise.all([p1, p2]);

    console.log("[TEST] Result 1:", r1.data || r1.error);
    console.log("[TEST] Result 2:", r2.data || r2.error);

    return { r1, r2 };
  } catch (err) {
    console.error("[TEST] Fatal error:", err);
    throw err;
  }
}
