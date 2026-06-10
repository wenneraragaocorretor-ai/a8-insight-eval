import { Link } from "@tanstack/react-router";
import { Instagram, Linkedin, Mail } from "lucide-react";

export function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[#0A1F44] overflow-x-hidden">
      <SiteNav />
      {children}
      <Footer />
    </div>
  );
}

function SiteNav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-[#0A1F44]/40 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1 select-none">
          <span className="font-display text-sm tracking-[0.3em] text-[#C8A951] uppercase">
            A8
          </span>
          <span className="font-display text-sm tracking-[0.3em] text-white/90 uppercase">
            Investimentos
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-10 text-sm tracking-wide text-white/80">
          <a href="/" className="hover:text-[#C8A951] transition-colors">
            Início
          </a>
          <a href="/#diferenciais" className="hover:text-[#C8A951] transition-colors">
            Diferenciais
          </a>
          <a href="/#como-funciona" className="hover:text-[#C8A951] transition-colors">
            Como funciona
          </a>
          <a href="/#planos" className="hover:text-[#C8A951] transition-colors">
            Planos
          </a>
          <a href="/#depoimentos" className="hover:text-[#C8A951] transition-colors">
            Depoimentos
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/auth"
            className="hidden sm:inline-flex text-sm text-white/90 hover:text-[#C8A951] transition-colors px-3 py-2"
          >
            Entrar
          </Link>
          <Link
            to="/planos"
            className="inline-flex items-center gap-2 bg-[#C8A951] text-[#0A1F44] text-sm font-semibold px-5 py-2.5 rounded-md hover:bg-[#E2C97E] transition-all hover:shadow-[0_8px_24px_-8px_rgba(200,169,81,0.6)]"
          >
            Começar Agora
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="bg-[#0A1F44] border-t border-[#C8A951]/20">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-1 mb-4">
              <span className="font-display text-sm tracking-[0.3em] text-[#C8A951] uppercase">
                A8
              </span>
              <span className="font-display text-sm tracking-[0.3em] text-white/90 uppercase">
                Investimentos
              </span>
            </div>
            <p className="text-white/60 text-sm font-light max-w-md leading-relaxed">
              A plataforma definitiva para corretores e avaliadores de imóveis
              que atuam no mercado de alto padrão.
            </p>
            <div className="flex gap-4 mt-6">
              <a
                href="#"
                aria-label="Instagram"
                className="w-10 h-10 rounded-full border border-[#C8A951]/30 flex items-center justify-center text-[#C8A951] hover:bg-[#C8A951] hover:text-[#0A1F44] transition-all"
              >
                <Instagram size={16} />
              </a>
              <a
                href="#"
                aria-label="LinkedIn"
                className="w-10 h-10 rounded-full border border-[#C8A951]/30 flex items-center justify-center text-[#C8A951] hover:bg-[#C8A951] hover:text-[#0A1F44] transition-all"
              >
                <Linkedin size={16} />
              </a>
              <a
                href="#"
                aria-label="Email"
                className="w-10 h-10 rounded-full border border-[#C8A951]/30 flex items-center justify-center text-[#C8A951] hover:bg-[#C8A951] hover:text-[#0A1F44] transition-all"
              >
                <Mail size={16} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-[#E2C97E] text-xs tracking-[0.3em] uppercase mb-5">Produto</h4>
            <ul className="space-y-3 text-sm text-white/70">
              <li><a href="/#diferenciais" className="hover:text-[#C8A951] transition-colors">Diferenciais</a></li>
              <li><a href="/#como-funciona" className="hover:text-[#C8A951] transition-colors">Como funciona</a></li>
              <li><a href="/#planos" className="hover:text-[#C8A951] transition-colors">Planos</a></li>
              <li><Link to="/auth" className="hover:text-[#C8A951] transition-colors">Entrar</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[#E2C97E] text-xs tracking-[0.3em] uppercase mb-5">Empresa</h4>
            <ul className="space-y-3 text-sm text-white/70">
              <li><a href="/#depoimentos" className="hover:text-[#C8A951] transition-colors">Depoimentos</a></li>
              <li><a href="#" className="hover:text-[#C8A951] transition-colors">Contato</a></li>
              <li><Link to="/termos" className="hover:text-[#C8A951] transition-colors">Termos</Link></li>
              <li><Link to="/privacidade" className="hover:text-[#C8A951] transition-colors">Privacidade</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[#C8A951]/15 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-white/50 text-xs">
            © 2026 A8 Investimentos Imobiliários. Todos os direitos reservados.
          </p>
          <p className="text-white/40 text-xs italic">
            Avaliações mercadológicas — não substituem laudo CNAI/IBAPE.
          </p>
        </div>
      </div>
    </footer>
  );
}
