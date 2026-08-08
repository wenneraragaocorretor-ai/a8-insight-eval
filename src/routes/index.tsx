import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";


import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Sparkles,
  Zap,
  ShieldCheck,
  BrainCircuit,
  ArrowRight,
  ChevronDown,
  Quote,
  Check,
  Loader2,
} from "lucide-react";
import heroImg from "../assets/hero-luxury.jpg";
import { LandingLayout } from "../components/landing/LandingLayout";
import { supabase } from "../integrations/supabase/client";
import { criarCheckoutSession } from "../lib/stripe.functions";
import { toast } from "sonner";

type PlanCode = "basico" | "profissional" | "expert";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "A8 Avalia — Avaliações Imobiliárias de Alto Padrão" },
      {
        name: "description",
        content:
          "Laudos de avaliação imobiliária mercadológicos gerados por inteligência artificial, conforme NBR 14653-2. Precisão, sofisticação e velocidade para corretores de alto padrão.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <LandingLayout>
      <Hero />
      <Diferenciais />
      <ComoFunciona />
      <Planos />
      <Depoimentos />
      <CtaFinal />
    </LandingLayout>
  );
}

/* ===================== HERO ===================== */
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center">
      <img
        src={heroImg}
        alt="Imóvel de alto padrão ao entardecer"
        className="absolute inset-0 w-full h-full object-cover"
        fetchPriority="high"
      />
      {/* Overlay gradient navy */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0A1F44]/95 via-[#0A1F44]/80 to-[#0F2D5C]/70" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A1F44] via-transparent to-[#0A1F44]/40" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 pt-32 pb-20 w-full">
        <div className="max-w-3xl reveal-up">
          <div className="flex items-center gap-3 mb-6">
            <span className="gold-divider" />
            <span className="text-xs tracking-[0.4em] uppercase text-[#E2C97E] font-medium">
              A8 Avalia
            </span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-medium text-white leading-[1.05] mb-8">
            Avaliações Imobiliárias <br />
            <span className="italic text-[#E2C97E]">de Alto Padrão.</span>
          </h1>
          <p className="text-lg sm:text-xl text-white/80 font-light max-w-2xl leading-relaxed mb-12">
            Laudos profissionais gerados por inteligência artificial em minutos.
            Precisão técnica conforme <span className="text-[#E2C97E]">NBR 14653-2</span>,
            para todo o mercado imobiliário.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/planos"
              className="group inline-flex items-center justify-center gap-3 bg-[#C8A951] text-[#0A1F44] font-semibold text-base px-8 py-4 rounded-md hover:bg-[#E2C97E] transition-all shadow-[0_20px_50px_-15px_rgba(200,169,81,0.6)] hover:shadow-[0_25px_60px_-15px_rgba(200,169,81,0.8)] hover:-translate-y-0.5"
            >
              Começar Agora
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center justify-center gap-2 text-white border border-white/30 hover:border-[#C8A951] hover:text-[#C8A951] text-base px-8 py-4 rounded-md transition-all"
            >
              Como funciona
            </a>
          </div>
        </div>
      </div>

      {/* scroll indicator */}
      <a
        href="#diferenciais"
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[#E2C97E] flex flex-col items-center gap-2"
      >
        <span className="text-[10px] tracking-[0.3em] uppercase">Role para descobrir</span>
        <ChevronDown size={22} className="animate-scroll-bounce" />
      </a>
    </section>
  );
}

/* ===================== DIFERENCIAIS ===================== */
function Diferenciais() {
  const itens = [
    {
      icon: ShieldCheck,
      titulo: "Precisão Técnica",
      desc: "Metodologia conforme NBR 14653-2 ABNT, com homogeneização e tratamento estatístico completos.",
    },
    {
      icon: Zap,
      titulo: "Velocidade Extrema",
      desc: "Da entrada de dados ao laudo finalizado em minutos. Sem planilhas, sem retrabalho.",
    },
    {
      icon: BrainCircuit,
      titulo: "Inteligência Artificial",
      desc: "Análise visual de fotos, perfil do público, estratégia de marketing e textos de anúncio prontos.",
    },
    {
      icon: Sparkles,
      titulo: "Imagem Profissional",
      desc: "Laudos de design sofisticado, com sua marca e identidade — para imóveis de alto padrão.",
    },
  ];

  return (
    <section id="diferenciais" className="py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <div className="flex justify-center mb-5">
            <span className="gold-divider" />
          </div>
          <span className="text-xs tracking-[0.4em] uppercase text-[#C8A951] font-medium">
            Por que a A8
          </span>
          <h2 className="font-display text-4xl sm:text-5xl text-[#0A1F44] mt-4 leading-tight">
            Tecnologia a serviço da <span className="italic">excelência</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {itens.map(({ icon: Icon, titulo, desc }) => (
            <div
              key={titulo}
              className="group relative bg-white border border-[#F5F5F5] rounded-md p-8 transition-all duration-500 hover:border-[#C8A951] hover:-translate-y-2 hover:shadow-[0_20px_50px_-15px_rgba(10,31,68,0.15)]"
            >
              <div className="w-14 h-14 rounded-md bg-gradient-to-br from-[#C8A951] to-[#E2C97E] flex items-center justify-center mb-6 shadow-[0_8px_20px_-8px_rgba(200,169,81,0.5)]">
                <Icon size={26} className="text-white" />
              </div>
              <h3 className="font-display text-xl text-[#0A1F44] mb-3">{titulo}</h3>
              <p className="text-sm text-[#666666] leading-relaxed font-light">{desc}</p>
              <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#C8A951] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===================== COMO FUNCIONA ===================== */
function ComoFunciona() {
  const passos = [
    {
      n: "01",
      titulo: "Preencha o imóvel",
      desc: "Dados, fotos, ambientes, lazer e localização. A IA cuida do resto.",
    },
    {
      n: "02",
      titulo: "Adicione comparáveis",
      desc: "Importe anúncios ou cadastre manualmente. Nosso sistema valida e padroniza.",
    },
    {
      n: "03",
      titulo: "IA processa o laudo",
      desc: "Homogeneização, dispersão, estatística e arbítrio em segundos.",
    },
    {
      n: "04",
      titulo: "Entregue com classe",
      desc: "PDF sofisticado pronto para impressionar — com sua identidade visual.",
    },
  ];

  return (
    <section id="como-funciona" className="py-28 relative bg-[#0A1F44] overflow-hidden">
      {/* subtle gold lines decoration */}
      <div className="absolute top-0 left-1/2 w-px h-20 bg-gradient-to-b from-transparent to-[#C8A951]/40" />
      <div className="absolute bottom-0 right-10 w-32 h-px bg-gradient-to-r from-transparent to-[#C8A951]/30" />

      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <div className="flex justify-center mb-5">
            <span className="gold-divider" />
          </div>
          <span className="text-xs tracking-[0.4em] uppercase text-[#E2C97E] font-medium">
            Processo Simples
          </span>
          <h2 className="font-display text-4xl sm:text-5xl text-white mt-4 leading-tight">
            Quatro passos. <span className="italic text-[#E2C97E]">Resultado profissional.</span>
          </h2>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-6">
          {/* connecting line */}
          <div className="hidden lg:block absolute top-10 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-[#C8A951]/40 to-transparent" />
          {passos.map((p) => (
            <div key={p.n} className="relative text-center lg:text-left">
              <div className="font-display text-7xl lg:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-[#C8A951] to-[#E2C97E] mb-4 leading-none">
                {p.n}
              </div>
              <h3 className="font-display text-2xl text-white mb-3">{p.titulo}</h3>
              <p className="text-sm text-white/70 leading-relaxed font-light max-w-xs mx-auto lg:mx-0">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===================== PLANOS ===================== */
function Planos() {
  const navigate = useNavigate();
  const startCheckout = useServerFn(criarCheckoutSession);
  const [loading, setLoading] = useState<PlanCode | null>(null);

  async function handleAssinar(code: PlanCode) {
    try {
      setLoading(code);
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        // Sem conta → vai pro cadastro rápido carregando o plano selecionado
        try {
          sessionStorage.setItem("a8_plano_pendente", code);
        } catch {}
        navigate({ to: "/auth", search: { plan: code } as any });
        return;
      }
      // Já logado → direto pro Stripe Checkout
      const origin = window.location.origin;
      const { url } = await startCheckout({ data: { plano: code, origin } });
      if (!url) throw new Error("URL de checkout não recebida");
      window.location.href = url;
    } catch (e: any) {
      console.error("[landing/assinar]", e);
      toast.error(e?.message ?? "Erro ao iniciar checkout. Tente novamente.");
      setLoading(null);
    }
  }

  const planos = [
    {
      code: "basico" as PlanCode,
      nome: "Básico",
      preco: "R$ 157",
      periodo: "/laudo",
      desc: "Pagamento único — 1 laudo por compra",
      itens: [
        "1 laudo por compra (avulso)",
        "Ficha técnica básica",
        "Até 3 fotos (sem análise da IA)",
        "Comparáveis simples",
        "PDF simples 4-5 páginas",
      ],
      destaque: false,
    },
    {
      code: "profissional" as PlanCode,
      nome: "Profissional",
      preco: "R$ 249",
      periodo: "/mês",
      desc: "Para corretores em ritmo de produção",
      itens: [
        "8 laudos por mês",
        "Ficha técnica completa",
        "Até 8 fotos com análise da IA",
        "Homogeneização dos comparáveis",
        "Tratamento estatístico básico",
        "PDF 8-10 páginas com sua marca",
        "Caracterização do bairro pela IA",
      ],
      destaque: false,
    },
    {
      code: "expert" as PlanCode,
      nome: "Expert",
      preco: "R$ 377",
      periodo: "/mês",
      desc: "O laudo definitivo para alto padrão",
      itens: [
        "Até 20 laudos/mês",
        "Tudo do Profissional +",
        "Laudos adicionais por R$ 12,00/laudo",
        "Até 10 fotos com análise individual da IA",
        "Gráfico de dispersão e curva de tendência",
        "Laudo completo NBR 14653-2",
        "Campo de arbítrio ±15% com justificativa",
        "Assistente de marketing completo",
        "Textos prontos para portais",
        "QR Code de autenticidade (LAU-XXXXXX)",
        "PDF 15+ páginas premium",
        "★ Chat com IA especialista integrado ao laudo",
      ],
      destaque: true,
    },
  ];

  return (
    <section id="planos" className="py-28 bg-[#F5F5F5]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <div className="flex justify-center mb-5">
            <span className="gold-divider" />
          </div>
          <span className="text-xs tracking-[0.4em] uppercase text-[#C8A951] font-medium">
            Planos
          </span>
          <h2 className="font-display text-4xl sm:text-5xl text-[#0A1F44] mt-4 leading-tight">
            Escolha o plano ideal <span className="italic">para você</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {planos.map((p) => (
            <div
              key={p.nome}
              className={[
                "relative bg-white rounded-lg p-10 transition-all duration-500 flex flex-col",
                p.destaque
                  ? "border-2 border-[#C8A951] shadow-[0_30px_60px_-20px_rgba(10,31,68,0.25)] md:-translate-y-4"
                  : "border border-[#E5E7EB] shadow-[0_10px_30px_-15px_rgba(10,31,68,0.1)] hover:shadow-[0_20px_40px_-15px_rgba(10,31,68,0.2)]",
              ].join(" ")}
            >
              {p.destaque && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full bg-gradient-to-r from-[#C8A951] to-[#E2C97E] text-[#0A1F44] text-[11px] font-bold uppercase tracking-[0.2em] shadow-lg">
                  Mais Completo
                </div>
              )}
              <h3 className="font-display text-2xl text-[#0A1F44] mb-1">{p.nome}</h3>
              <p className="text-sm text-[#666666] mb-8 font-light">{p.desc}</p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="font-display text-5xl font-bold text-[#0A1F44]">{p.preco}</span>
                <span className="text-[#666666] text-sm">{p.periodo}</span>
              </div>
              <span className="gold-divider mb-6" />
              <ul className="space-y-3 mb-10 flex-1">
                {p.itens.map((it) => {
                  const destaqueOuro = it.startsWith("★ ");
                  const texto = destaqueOuro ? it.slice(2) : it;
                  return (
                    <li
                      key={it}
                      className={`flex items-start gap-3 text-sm text-[#0A1F44] ${destaqueOuro ? "font-semibold bg-[#C8A951]/10 -mx-2 px-2 py-1.5 rounded-md" : ""}`}
                    >
                      {destaqueOuro ? (
                        <Sparkles size={16} className="text-[#C8A951] mt-0.5 shrink-0" />
                      ) : (
                        <Check size={16} className="text-[#C8A951] mt-0.5 shrink-0" />
                      )}
                      <span>{texto}</span>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => handleAssinar(p.code)}
                className={[
                  "inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-md font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed",
                  p.destaque
                    ? "bg-[#C8A951] text-[#0A1F44] hover:bg-[#E2C97E] shadow-[0_15px_30px_-10px_rgba(200,169,81,0.5)]"
                    : "bg-[#0A1F44] text-white hover:bg-[#0F2D5C]",
                ].join(" ")}
              >
                {loading === p.code ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Redirecionando...
                  </>
                ) : (
                  <>
                    Assinar {p.nome}
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ===================== DEPOIMENTOS ===================== */
function Depoimentos() {
  const depos = [
    {
      nome: "Ricardo Mendes",
      papel: "Corretor — Alphaville/SP",
      texto:
        "A8 elevou o nível dos meus laudos. Clientes de R$ 5 milhões esperam apresentações dessa qualidade. Vendi um imóvel em 18 dias.",
    },
    {
      nome: "Patrícia Lobo",
      papel: "Avaliadora CNAI — Curitiba/PR",
      texto:
        "A homogeneização e o tratamento estatístico ficam impecáveis. Reduzi 80% do tempo gasto por avaliação.",
    },
    {
      nome: "Eduardo Tavares",
      papel: "Diretor — Imobiliária Vértice",
      texto:
        "Toda minha equipe migrou. O laudo Expert tem cara de relatório de banco de investimento. Vale cada centavo.",
    },
  ];

  return (
    <section id="depoimentos" className="py-28 bg-[#0A1F44]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <div className="flex justify-center mb-5">
            <span className="gold-divider" />
          </div>
          <span className="text-xs tracking-[0.4em] uppercase text-[#E2C97E] font-medium">
            Quem usa, recomenda
          </span>
          <h2 className="font-display text-4xl sm:text-5xl text-white mt-4 leading-tight">
            Profissionais que confiam <br />
            na <span className="italic text-[#E2C97E]">A8</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {depos.map((d) => {
            const iniciais = d.nome
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("");
            return (
              <figure
                key={d.nome}
                className="relative bg-[#0F2D5C]/60 backdrop-blur border border-[#C8A951]/15 rounded-lg p-8 flex flex-col"
              >
                <Quote size={36} className="text-[#C8A951] mb-4" />
                <blockquote className="text-white/85 leading-relaxed font-light text-[15px] flex-1">
                  "{d.texto}"
                </blockquote>
                <figcaption className="flex items-center gap-4 mt-8 pt-6 border-t border-white/10">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#C8A951] to-[#E2C97E] flex items-center justify-center text-[#0A1F44] font-bold text-sm shadow-[0_8px_20px_-8px_rgba(200,169,81,0.6)]">
                    {iniciais}
                  </div>
                  <div>
                    <div className="text-white font-medium text-sm">{d.nome}</div>
                    <div className="text-white/60 text-xs">{d.papel}</div>
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ===================== CTA FINAL ===================== */
function CtaFinal() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6 lg:px-10 text-center">
        <div className="flex justify-center mb-6">
          <span className="gold-divider" />
        </div>
        <h2 className="font-display text-4xl sm:text-5xl text-[#0A1F44] leading-tight mb-6">
          Pronto para elevar o padrão <br />
          das suas <span className="italic">avaliações?</span>
        </h2>
        <p className="text-[#666666] text-lg font-light max-w-2xl mx-auto mb-10">
          Comece em minutos. Cancele quando quiser.
        </p>
        <Link
          to="/planos"
          className="inline-flex items-center gap-3 bg-[#0A1F44] text-white font-semibold px-10 py-4 rounded-md hover:bg-[#0F2D5C] transition-all shadow-[0_20px_50px_-15px_rgba(10,31,68,0.45)] hover:-translate-y-0.5"
        >
          Começar Agora
          <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}

