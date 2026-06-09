import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Check, ArrowLeft, Loader2 } from "lucide-react";
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
    preco: "R$ 99,90",
    destaque: false,
    db: "user",
    features: [
      "Até 3 avaliações por mês",
      "Estudo de mercado simplificado",
      "Geração de PDF",
      "Suporte por e-mail",
    ],
  },
  {
    code: "profissional" as const,
    nome: "Profissional",
    preco: "R$ 159,90",
    destaque: true,
    db: "pro",
    features: [
      "Avaliações ilimitadas",
      "Estudo de mercado completo",
      "Comparativos com IA avançada",
      "Geração de PDF",
      "Suporte prioritário",
    ],
  },
  {
    code: "expert" as const,
    nome: "Expert",
    preco: "R$ 297,00",
    destaque: false,
    db: "expert",
    features: [
      "Tudo do Profissional",
      "Laudo NBR 14.653",
      "Homogeneização avançada",
      "Suporte dedicado",
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
        .then(() => {
          toast.success("Assinatura ativada com sucesso!");
          refetch();
        })
        .catch(() => {
          toast.info("Pagamento recebido. A assinatura será ativada em instantes.");
          setTimeout(() => refetch(), 3000);
        });
    } else if (search.canceled) {
      toast.error("Checkout cancelado");
    }
  }, [search.success, search.canceled, search.session_id]);

  async function assinar(plano: "basico" | "profissional" | "expert") {
    try {
      setLoading(plano);
      const origin =
        (window.top && window.top !== window.self ? window.top.location.origin : null) ??
        window.location.origin;
      const { url } = await startCheckout({ data: { plano, origin } });
      if (!url) throw new Error("URL de checkout não recebida");

      // Em iframes (ex.: preview do Lovable) navegar window.location pode falhar
      // silenciosamente. Tentamos abrir em nova aba primeiro; se bloqueado,
      // caímos para navegação top-level.
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

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Voltar ao dashboard
      </Link>

      <div className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-brand-blue">Escolha seu plano</h1>
        <p className="text-muted-foreground">Avaliações imobiliárias inteligentes com IA</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANOS.map((p) => {
          const ehAtual = ativa && planoAtual === p.db;
          return (
            <Card
              key={p.code}
              className={`premium-card relative ${p.destaque ? "border-brand-gold border-2 shadow-xl scale-[1.02]" : ""}`}
            >
              {p.destaque && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-gold text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                  MAIS POPULAR
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl text-brand-blue">{p.nome}</CardTitle>
                <div className="mt-2">
                  <span className="text-4xl font-bold">{p.preco}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-brand-gold shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full h-11 ${p.destaque ? "bg-brand-gold text-primary-foreground hover:opacity-90" : ""}`}
                  variant={p.destaque ? "default" : "outline"}
                  disabled={loading !== null || ehAtual}
                  onClick={() => assinar(p.code)}
                >
                  {loading === p.code ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Redirecionando...</>
                  ) : ehAtual ? "Plano atual" : "Assinar"}
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
