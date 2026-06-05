import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "A8 Investimentos Imobiliários" },
      { name: "description", content: "Gerando riqueza, construindo patrimônio. A plataforma SaaS definitiva para avaliações imobiliárias com IA." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center">
      <nav className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
        <div className="text-2xl font-bold text-[var(--color-brand-blue)] flex items-center gap-1">
          A8 <span className="text-[var(--color-brand-gold)]">Investimentos</span>
        </div>
        <div className="flex gap-4">
          <a href="/login" className="px-4 py-2 text-sm font-medium text-[var(--color-brand-blue)]">Entrar</a>
          <a href="/cadastro" className="px-4 py-2 text-sm font-medium bg-[var(--color-brand-blue)] text-white rounded-lg hover:opacity-90">Começar grátis</a>
        </div>
      </nav>
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <h1 className="text-5xl md:text-6xl font-bold text-[var(--color-brand-blue)] mb-6">
          Gerando riqueza,<br />construindo patrimônio.
        </h1>
        <p className="text-xl text-[var(--muted-foreground)] max-w-2xl mb-10">
          Plataforma SaaS para corretores e avaliadores de imóveis realizarem avaliações mercadológicas de alta precisão com auxílio de inteligência artificial.
        </p>
        <a href="/cadastro" className="px-8 py-4 bg-[var(--color-brand-gold)] text-[var(--primary-foreground)] rounded-xl text-lg font-bold hover:opacity-90 transition-transform hover:scale-105">
          Começar Avaliação Grátis
        </a>
      </main>
    </div>
  );
}
