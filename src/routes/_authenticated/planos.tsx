import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Check, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { criarCheckoutSession, getStatusAssinatura, confirmarCheckout } from "../../lib/stripe.functions";
import { toast } from "sonner";

type Search = { success?: string; canceled?: string; session_id?: string };

export const Route = createFileRoute("/_authenticated/planos")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    success: s.success as string | undefined,
    canceled: s.canceled as string | undefined,
    session_id: s.session_id as string | undefined,
  }),
  component: PlanosPage,
});

const PLANOS = [
  {
    code: "basico" as const,
    nome: "Básico",
    preco: "R$ 157",
    periodo: "/laudo",
    modo: "avulso" as const,
    destaque: false,
    badge: null as string | null,
    subtitulo: "Pagamento único — 1 laudo por compra",
    db: "basico",
    features: [
      "1 laudo por compra (avulso)",
      "Ficha técnica completa",
      "Até 3 fotos com análise da IA",
      "Pesquisa de comparáveis de mercado",
      "Mapa de localização",
      "PDF com logo e dados do corretor",
      "Laudo com marca d'água A8",
      "1 edição por laudo",
    ],
  },
  {
    code: "profissional" as const,
    nome: "Profissional",
    preco: "R$ 249",
    periodo: "/mês",
    modo: "assinatura" as const,
    destaque: false,
    badge: "Melhor Custo-Benefício" as string | null,
    subtitulo: "Para corretores em ritmo de produção",
    db: "profissional",
    features: [
      "8 laudos por mês",
      "Ficha técnica completa",
      "Até 8 fotos com análise da IA",
      "Homogeneização dos comparáveis",
      "Tratamento estatístico básico",
      "Mapa de localização",
      "Caracterização do bairro pela IA",
      "Perfil do público-alvo",
      "PDF 8-10 páginas sem marca d'água",
      "1 edição por laudo",
    ],
  },
  {
    code: "expert" as const,
    nome: "Expert",
    preco: "R$ 377",
    periodo: "/mês",
    modo: "assinatura" as const,
    destaque: true,
    badge: "Mais Completo" as string | null,
    subtitulo: "O laudo definitivo para qualquer imóvel",
    db: "expert",
    features: [
      "Até 20 laudos/mês",
      "Tudo do Profissional +",
      "Até 10 fotos com análise individual da IA",
      "Gráfico de dispersão e curva de tendência",
      "Laudo completo NBR 14653-2",
      "Campo de arbítrio ±15% com justificativa técnica",
      "Assistente de marketing completo",
      "Textos de anúncio prontos para portais",
      "Estratégia de divulgação por canais",
      "QR Code de autenticidade no laudo",
      "Número do laudo (LAU-XXXXXX)",
      "PDF 15+ páginas sem marca d'água",
      "Chat com IA especialista integrado ao laudo",
      "Laudos adicionais por R$ 12,00/laudo",
      "1 edição por laudo",
    ],
  },
];


function PlanosPage() {
  const search = useSearch({ from: "/_authenticated/planos" });
  const fetchStatus = useServerFn(getStatusAssinatura);
  const startCheckout = useServerFn(criarCheckoutSession);
  const confirm = useServerFn(confirmarCheckout);
  const [loading, setLoading] = useState<string | null>(null);

  const { data: status, refetch } = useQuery({
    queryKey: ["assinatura-status"],
    queryFn: () => fetchStatus(),
  });

  useEffect(() => {
    if (search.success && search.session_id) {
      confirm({ data: { session_id: search.session_id } })
        .then((res: any) => {
          if (res?.plano === "basico") toast.success("Compra confirmada! +1 laudo Básico disponível.");
          else toast.success("Assinatura ativada com sucesso!");
          refetch();
        })
        .catch(() => {
          toast.info("Pagamento recebido. Será processado em instantes.");
          setTimeout(() => refetch(), 3000);
        });
    } else if (search.canceled) {
      toast.error("Checkout cancelado");
    }
  }, [search.success, search.canceled, search.session_id]);

  async function assinar(plano: "basico" | "profissional" | "expert" | "expert_extra") {
    try {
      setLoading(plano);
      const origin =
        (window.top && window.top !== window.self ? window.top.location.origin : null) ??
        window.location.origin;
      const { url } = await startCheckout({ data: { plano, origin } });
      if (!url) throw new Error("URL de checkout não recebida");

      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) {
        try {
          if (window.top) window.top.location.href = url;
          else window.location.href = url;
        } catch {
          window.location.href = url;
        }
      }
      setLoading(null);
    } catch (e: any) {
      console.error("[checkout]", e);
      toast.error(e?.message ?? "Erro ao iniciar checkout. Tente novamente.");
      setLoading(null);
    }
  }

  const planoAtual = status?.plano;
  const ativa = status?.assinaturaAtiva;
  const ehExpert = ativa && planoAtual === "expert";
  const usoMes = status?.avaliacoesMes ?? 0;
  const limiteMes = status?.limiteMes ?? null;
  const creditosAvulsos = status?.creditosAvulsos ?? 0;
  const atingiuLimiteExpert = ehExpert && limiteMes !== null && usoMes >= limiteMes;

  const getButtonProps = (p: (typeof PLANOS)[number]) => {
    if (p.code === "basico") {
      return {
        variant: "outline" as const,
        className: "w-full h-11 border-[#0A1F44] text-[#0A1F44] hover:bg-[#0A1F44] hover:text-white",
      };
    }
    if (p.code === "profissional") {
      return {
        variant: "default" as const,
        className: "w-full h-11 bg-[#C8A951] text-[#0A1F44] hover:opacity-90",
      };
    }
    // expert
    return {
      variant: "default" as const,
      className: "w-full h-11 bg-[#0A1F44] text-white hover:bg-[#0F2D5C]",
    };
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Voltar ao dashboard
      </Link>

      <div className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-brand-blue">Escolha seu plano</h1>
        <p className="text-muted-foreground">Avaliações imobiliárias inteligentes com IA</p>
      </div>

      {ehExpert && (
        <Card className={`border-2 ${atingiuLimiteExpert ? "border-[#C8A951] bg-[#C8A951]/5" : "border-brand-blue/20"}`}>
          <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-brand-blue">
                {atingiuLimiteExpert ? "Limite mensal atingido" : "Laudos extras do Plano Expert"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Uso este mês: <strong>{usoMes}</strong>{limiteMes ? ` / ${limiteMes}` : ""} laudos
                {creditosAvulsos > 0 && <> · Créditos avulsos disponíveis: <strong>{creditosAvulsos}</strong></>}
              </p>
              <p className="text-sm text-muted-foreground">
                {atingiuLimiteExpert
                  ? "Você atingiu os 20 laudos inclusos. Compre laudos adicionais por R$ 12,00 cada para continuar emitindo este mês."
                  : "Precisa de mais que 20 laudos/mês? Compre laudos adicionais por R$ 12,00 cada — ficam disponíveis na sua conta."}
              </p>
            </div>
            <Button
              className="bg-[#C8A951] text-[#0A1F44] hover:opacity-90 h-11 px-6 shrink-0"
              disabled={loading !== null}
              onClick={() => assinar("expert_extra")}
            >
              {loading === "expert_extra" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Redirecionando...</>
              ) : "Comprar laudo extra (R$ 12,00)"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANOS.map((p) => {
          const ehAtual = ativa && planoAtual === p.db;
          const btn = getButtonProps(p);
          return (
            <Card
              key={p.code}
              className={`premium-card relative ${p.destaque ? "border-brand-gold border-2 shadow-xl scale-[1.02]" : ""}`}
            >
              {p.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C8A951] text-[#0A1F44] text-xs font-bold px-3 py-1 rounded-full">
                  {p.badge}
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl text-brand-blue">{p.nome}</CardTitle>
                <div className="mt-2">
                  <span className="text-4xl font-bold">{p.preco}</span>
                  <span className="text-muted-foreground">{p.periodo}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{p.subtitulo}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {p.features.map((f) => {
                    const destaqueOuro = f.startsWith("★ ");
                    const texto = destaqueOuro ? f.slice(2) : f;
                    return (
                      <li
                        key={f}
                        className={`flex items-start gap-2 text-sm ${destaqueOuro ? "font-semibold text-brand-blue bg-brand-gold/10 -mx-2 px-2 py-1.5 rounded-md" : ""}`}
                      >
                        {destaqueOuro ? (
                          <Sparkles className="h-4 w-4 text-brand-gold shrink-0 mt-0.5" />
                        ) : (
                          <Check className="h-4 w-4 text-brand-gold shrink-0 mt-0.5" />
                        )}
                        <span>{texto}</span>
                      </li>
                    );
                  })}
                </ul>
                <Button
                  className={btn.className}
                  variant={btn.variant}
                  disabled={loading !== null || (p.modo === "assinatura" && ehAtual)}
                  onClick={() => assinar(p.code)}
                >
                  {loading === p.code ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Redirecionando...</>
                  ) : p.modo === "avulso" ? (
                    "Comprar Laudo"
                  ) : ehAtual ? (
                    "Plano atual"
                  ) : p.code === "profissional" ? (
                    "Assinar Profissional"
                  ) : p.code === "expert" ? (
                    "Assinar Expert"
                  ) : (
                    "Assinar"
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Pagamento seguro processado pelo Stripe. Cancele quando quiser.
      </p>
    </div>
  );
}
