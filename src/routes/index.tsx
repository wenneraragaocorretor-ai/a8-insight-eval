import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calculator, FileText, LayoutDashboard, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6">
      <div className="max-w-3xl w-full text-center space-y-8">
        <div className="inline-flex items-center gap-2 bg-brand-gold/10 text-brand-gold px-4 py-2 rounded-full border border-brand-gold/20 animate-in fade-in slide-in-from-top-4 duration-1000">
          <Sparkles size={16} />
          <span className="text-sm font-semibold tracking-wide">TECNOLOGIA EXCLUSIVA PARA CORRETORES</span>
        </div>
        
        <h1 className="text-4xl md:text-6xl font-bold text-brand-blue tracking-tight leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          Avaliações de Imóveis <br />
          <span className="text-brand-gold">em Segundos com IA</span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          Gere laudos técnicos profissionais, estudos de mercado e estratégias de venda utilizando o poder da inteligência artificial avançada.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
          <Link to="/dashboard">
            <Button className="h-14 px-8 text-lg bg-brand-blue hover:bg-brand-blue/90 gap-2 shadow-xl shadow-brand-blue/20 w-full sm:w-auto">
              <LayoutDashboard size={20} />
              Acessar Plataforma
              <ArrowRight size={18} />
            </Button>
          </Link>
          <Link to="/avaliacoes/nova">
            <Button variant="outline" className="h-14 px-8 text-lg border-brand-blue text-brand-blue hover:bg-brand-blue/5 w-full sm:w-auto">
              <Calculator size={20} className="mr-2" />
              Nova Avaliação
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-700">
          <div className="p-6 bg-card rounded-2xl border border-border/50 text-left space-y-3">
            <div className="h-10 w-10 rounded-lg bg-brand-gold/10 flex items-center justify-center text-brand-gold">
              <FileText size={24} />
            </div>
            <h3 className="font-bold text-brand-blue">Laudos Profissionais</h3>
            <p className="text-sm text-muted-foreground">Documentos estruturados com tratamento estatístico e regressão linear.</p>
          </div>
          <div className="p-6 bg-card rounded-2xl border border-border/50 text-left space-y-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <Sparkles size={24} />
            </div>
            <h3 className="font-bold text-brand-blue">Marketing com IA</h3>
            <p className="text-sm text-muted-foreground">Textos prontos para portais, WhatsApp e identificação de público-alvo.</p>
          </div>
          <div className="p-6 bg-card rounded-2xl border border-border/50 text-left space-y-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
              <ShieldCheck size={24} />
            </div>
            <h3 className="font-bold text-brand-blue">Segurança de Dados</h3>
            <p className="text-sm text-muted-foreground">Persistência segura em nuvem e exportação de PDFs em alta resolução.</p>
          </div>
        </div>

        <footer className="pt-16 pb-8 border-t border-border/40">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            &copy; {new Date().getFullYear()} A8 AVALIA — Inteligência Imobiliária de Ponta
          </p>
        </footer>
      </div>
    </div>
  ),
});