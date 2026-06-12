import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ChatBody = {
  messages?: UIMessage[];
  avaliacaoId?: string;
};

const SYSTEM_BASE =
  "Você é um especialista em avaliação imobiliária e na norma técnica ABNT NBR 14653-2. " +
  "Responda dúvidas técnicas sobre o laudo gerado, comparáveis, homogeneização, tratamento estatístico " +
  "e campo de arbítrio. Seja objetivo, técnico e didático. Use o contexto do laudo fornecido abaixo " +
  "como base para responder com precisão.";

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

async function loadContext(
  supabaseUrl: string,
  publishableKey: string,
  accessToken: string,
  avaliacaoId: string | undefined,
) {
  if (!avaliacaoId) return null;
  // Carrega como usuário autenticado para respeitar RLS
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" } as const;

  // Verifica plano Expert
  const { data: profile } = await supabase
    .from("profiles")
    .select("plano")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.plano !== "expert") return { error: "Forbidden" } as const;

  const { data: avaliacao } = await supabase
    .from("avaliacoes")
    .select("id, tipo_imovel, localizacao, endereco_completo, area_total, quartos, suites, banheiros, vagas, padrao, conservacao, idade_real, observacoes")
    .eq("id", avaliacaoId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!avaliacao) return { error: "NotFound" } as const;

  const { data: resultado } = await supabase
    .from("resultados")
    .select("valor_minimo, valor_central, valor_maximo, valor_unitario_medio, coeficiente_variacao, relatorio_json")
    .eq("avaliacao_id", avaliacaoId)
    .maybeSingle();

  const { data: comparaveis } = await supabase
    .from("comparaveis")
    .select("fonte, localizacao, area, quartos, banheiros, vagas, valor_anunciado, valor_homogeneizado")
    .eq("avaliacao_id", avaliacaoId)
    .limit(15);

  return { avaliacao, resultado, comparaveis: comparaveis ?? [] };
}

function buildSystemPrompt(ctx: any): string {
  if (!ctx || ctx.error) return SYSTEM_BASE;
  const { avaliacao, resultado, comparaveis } = ctx;
  const compLines = (comparaveis ?? []).slice(0, 10).map((c: any, i: number) =>
    `${i + 1}. ${c.localizacao ?? "—"} | ${c.area ?? "—"}m² | ${c.quartos ?? "—"}q/${c.banheiros ?? "—"}b/${c.vagas ?? "—"}v | anunc: ${fmtBRL(c.valor_anunciado)}${c.valor_homogeneizado ? ` | hom: ${fmtBRL(c.valor_homogeneizado)}` : ""}`,
  ).join("\n");

  return `${SYSTEM_BASE}

DADOS DO LAUDO ATUAL:
- Imóvel: ${avaliacao.tipo_imovel ?? "—"} em ${avaliacao.localizacao ?? "—"}
- Endereço: ${avaliacao.endereco_completo ?? "—"}
- Área: ${avaliacao.area_total ?? "—"} m² | ${avaliacao.quartos ?? "—"} quartos (${avaliacao.suites ?? 0} suítes) | ${avaliacao.banheiros ?? "—"} banheiros | ${avaliacao.vagas ?? "—"} vagas
- Padrão: ${avaliacao.padrao ?? "—"} | Conservação: ${avaliacao.conservacao ?? "—"} | Idade: ${avaliacao.idade_real ?? "—"} anos

VALORES CALCULADOS:
- Mínimo: ${fmtBRL(resultado?.valor_minimo)}
- Central: ${fmtBRL(resultado?.valor_central)}
- Máximo: ${fmtBRL(resultado?.valor_maximo)}
- Valor unitário médio: ${resultado?.valor_unitario_medio ? `${fmtBRL(resultado.valor_unitario_medio)}/m²` : "—"}
- Coeficiente de variação: ${resultado?.coeficiente_variacao != null ? `${(resultado.coeficiente_variacao * 100).toFixed(1)}%` : "—"}

COMPARÁVEIS (${comparaveis?.length ?? 0}):
${compLines || "—"}

OBSERVAÇÕES DO CORRETOR: ${avaliacao.observacoes ?? "—"}`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatBody;
        const messages = body.messages;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          console.error("[api/chat] Missing required env var: LOVABLE_API_KEY is not set on the server");
          return new Response(
            "Serviço temporariamente indisponível. Tente novamente em instantes.",
            { status: 503 },
          );
        }

        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const authHeader = request.headers.get("authorization") ?? "";
        const accessToken = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7)
          : "";
        if (!supabaseUrl || !publishableKey || !accessToken) {
          return new Response("Unauthorized", { status: 401 });
        }

        const ctx: any = await loadContext(supabaseUrl, publishableKey, accessToken, body.avaliacaoId);
        if (ctx?.error === "Unauthorized") return new Response("Unauthorized", { status: 401 });
        if (ctx?.error === "Forbidden") {
          return new Response("Suporte por chat disponível apenas no plano Expert.", { status: 403 });
        }
        if (ctx?.error === "NotFound") return new Response("Avaliação não encontrada", { status: 404 });

        // Se não há avaliacaoId, ainda assim verifica plano expert do usuário
        if (!body.avaliacaoId) {
          const { createClient } = await import("@supabase/supabase-js");
          const supabase = createClient(supabaseUrl, publishableKey, {
            global: { headers: { Authorization: `Bearer ${accessToken}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return new Response("Unauthorized", { status: 401 });
          const { data: profile } = await supabase.from("profiles").select("plano").eq("id", user.id).maybeSingle();
          if (profile?.plano !== "expert") {
            return new Response("Suporte por chat disponível apenas no plano Expert.", { status: 403 });
          }
        }

        const gateway = createLovableAiGatewayProvider(apiKey);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: buildSystemPrompt(ctx),
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
