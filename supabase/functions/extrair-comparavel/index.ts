import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um extrator de dados imobiliários.
Analise o HTML fornecido e extraia em JSON:
{
  fonte: domínio do site,
  localizacao: bairro e cidade,
  area_total: número em m²,
  area_privativa: número em m² se disponível,
  area_construida: número em m² se disponível,
  valor: número sem formatação,
  quartos: número,
  suites: número,
  banheiros: número,
  vagas: número,
  vagas_cobertas: número,
  padrao_construtivo: Simples/Normal/Alto/Luxo,
  estado_conservacao: Ótimo/Bom/Regular/Ruim,
  idade: número em anos se disponível,
  caracteristicas: array de strings
}
Retorne APENAS o JSON sem texto adicional. Use null quando o dado não estiver disponível.`;

function limparHtml(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  // Truncate to keep prompt size reasonable
  if (s.length > 80000) s = s.slice(0, 80000);
  return s;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: URL;
    try { parsed = new URL(url); } catch {
      return new Response(JSON.stringify({ error: "URL inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return new Response(JSON.stringify({ error: "URL inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the page HTML
    let html = "";
    try {
      const resp = await fetch(parsed.toString(), {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; A8Avalia/1.0; +https://a8avalia.com.br)",
          "Accept": "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: `Falha ao acessar URL (status ${resp.status})` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      html = await resp.text();
    } catch (e: any) {
      return new Response(JSON.stringify({ error: "Não foi possível acessar a página: " + (e?.message ?? "erro de rede") }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const htmlLimpo = limparHtml(html);
    const dominio = parsed.hostname.replace(/^www\./, "");

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") ?? Deno.env.get("CHAVE_API_ANTROPICA") ?? "";
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `URL: ${parsed.toString()}\nDomínio: ${dominio}\n\nHTML:\n${htmlLimpo}`,
          },
        ],
      }),
    });

    if (!claudeResp.ok) {
      const errTxt = await claudeResp.text();
      console.error("Claude API error:", claudeResp.status, errTxt);
      return new Response(JSON.stringify({ error: "Erro na IA: " + claudeResp.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeJson = await claudeResp.json();
    const texto: string = claudeJson?.content?.[0]?.text ?? "";
    // Extract JSON block
    let jsonStr = texto.trim();
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) jsonStr = match[0];

    let dados: any;
    try {
      dados = JSON.parse(jsonStr);
    } catch {
      return new Response(JSON.stringify({ error: "Resposta da IA não pôde ser interpretada" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!dados.fonte) dados.fonte = dominio;

    return new Response(JSON.stringify({ dados }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[extrair-comparavel] erro:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
