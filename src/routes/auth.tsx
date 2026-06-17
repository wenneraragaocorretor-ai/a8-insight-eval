import { createFileRoute, useNavigate, Link, redirect, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "../integrations/supabase/client";
import { lovable } from "../integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { criarCheckoutSession } from "../lib/stripe.functions";

type PlanCode = "basico" | "profissional" | "expert";
const PLAN_LABEL: Record<PlanCode, string> = {
  basico: "Básico",
  profissional: "Profissional",
  expert: "Expert",
};

function readPendingPlan(searchPlan: string | undefined): PlanCode | null {
  const candidate = (searchPlan ?? (typeof window !== "undefined" ? sessionStorage.getItem("a8_plano_pendente") : null)) as PlanCode | null;
  if (candidate === "basico" || candidate === "profissional" || candidate === "expert") return candidate;
  return null;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    plan: typeof s.plan === "string" ? s.plan : undefined,
  }),
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const plan = (search as any)?.plan as string | undefined;
      // Se já está logado e veio com um plano selecionado, deixa o componente
      // disparar o checkout (não dá pra chamar server fn no beforeLoad sem context).
      if (plan === "basico" || plan === "profissional" || plan === "expert") return;
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const startCheckout = useServerFn(criarCheckoutSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [redirectingToCheckout, setRedirectingToCheckout] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "signup">(readPendingPlan(search.plan) ? "signup" : "login");
  const triggered = useRef(false);
  const justSignedUp = useRef(false);

  const pendingPlan = readPendingPlan(search.plan);

  async function continuarFluxo() {
    if (triggered.current) return;
    // Após CADASTRO: obrigatoriamente para /planos (escolhe plano antes de acessar).
    let justSignedUpFlag = false;
    try { justSignedUpFlag = sessionStorage.getItem("a8_just_signed_up") === "true"; } catch {}
    if (justSignedUp.current || justSignedUpFlag) {
      triggered.current = true;
      try {
        sessionStorage.removeItem("a8_plano_pendente");
        sessionStorage.removeItem("a8_just_signed_up");
      } catch {}
      navigate({ to: "/planos" });
      return;
    }
    // Após LOGIN: se há plano pendente da landing → direto ao Stripe.
    const plano = readPendingPlan(search.plan);
    if (plano) {
      triggered.current = true;
      setRedirectingToCheckout(true);
      try {
        const origin = window.location.origin;
        const { url } = await startCheckout({ data: { plano, origin } });
        try { sessionStorage.removeItem("a8_plano_pendente"); } catch {}
        if (!url) throw new Error("URL de checkout não recebida");
        window.location.href = url;
      } catch (e: any) {
        console.error("[auth/checkout]", e);
        toast.error(e?.message ?? "Erro ao iniciar pagamento.");
        setRedirectingToCheckout(false);
        triggered.current = false;
        navigate({ to: "/planos" });
      }
      return;
    }
    // Login normal sem plano pendente → dashboard (guard interno redireciona p/ /planos se necessário).
    triggered.current = true;
    navigate({ to: "/dashboard" });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) continuarFluxo();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        continuarFluxo();
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Bem-vindo de volta!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      justSignedUp.current = true;
      try { sessionStorage.setItem("a8_just_signed_up", "true"); } catch {}
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + "/planos",
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Não foi possível criar a conta.");

      triggered.current = true;
      try { sessionStorage.removeItem("a8_plano_pendente"); } catch {}

      // Aguarda a sessão estar persistida antes de redirecionar — senão o guard
      // do /_authenticated/planos bouncea para /auth (sem sessão no localStorage).
      let session = data.session;
      if (!session) {
        for (let i = 0; i < 30; i++) {
          const { data: s } = await supabase.auth.getSession();
          if (s.session) { session = s.session; break; }
          await new Promise((r) => setTimeout(r, 150));
        }
      }
      try { sessionStorage.removeItem("a8_just_signed_up"); } catch {}

      if (!session) {
        // Sem sessão (provavelmente confirmação por e-mail obrigatória).
        toast.success("Conta criada! Confirme seu e-mail para continuar e escolher seu plano.");
        justSignedUp.current = false;
        triggered.current = false;
        return;
      }

      console.log("[signup] sessão pronta, redirecionando para /planos");
      toast.success("Cadastro realizado! Escolha seu plano para continuar.");
      // window.location garante reload do guard com sessão fresca.
      window.location.href = "/planos";
    } catch (error: any) {
      justSignedUp.current = false;
      try { sessionStorage.removeItem("a8_just_signed_up"); } catch {}
      toast.error(error.message || "Erro ao criar conta");

    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: typeof window !== "undefined" ? window.location.origin + "/auth" + (pendingPlan ? `?plan=${pendingPlan}` : "") : "",
      });
      if (result.error) throw result.error;
    } catch (error: any) {
      toast.error(error.message || "Erro ao entrar com Google");
    }
  };


  if (redirectingToCheckout) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="text-center space-y-3">
          <div className="text-brand-blue font-semibold text-lg">Redirecionando para o pagamento…</div>
          <p className="text-sm text-muted-foreground">Não feche esta janela.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-bold text-brand-blue flex items-center justify-center gap-1 mb-2">
            A8 <span className="text-brand-gold">Avalia</span>
          </Link>
          <p className="text-muted-foreground">Gerando riqueza, construindo patrimônio</p>
        </div>

        {pendingPlan && (
          <div className="mb-4 rounded-md border border-brand-gold/40 bg-brand-gold/10 text-[#0A1F44] text-sm px-4 py-3">
            Plano selecionado: <strong>{PLAN_LABEL[pendingPlan]}</strong>. Faça login ou crie sua conta para continuar até o pagamento.
          </div>
        )}

        <Tabs defaultValue={pendingPlan ? "signup" : "login"} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Cadastro</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card className="premium-card">
              <CardHeader>
                <CardTitle>Entrar</CardTitle>
                <CardDescription>Acesse sua conta para continuar.</CardDescription>
              </CardHeader>
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                  <Button type="submit" className="w-full bg-brand-blue" disabled={isLoading}>
                    {isLoading ? "Entrando..." : pendingPlan ? "Entrar e continuar para pagamento" : "Entrar"}
                  </Button>
                  <div className="relative w-full">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Ou continue com</span></div>
                  </div>
                  <Button type="button" variant="outline" className="w-full" onClick={handleGoogleLogin}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4 mr-2" />
                    Google
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card className="premium-card">
              <CardHeader>
                <CardTitle>Criar conta</CardTitle>
                <CardDescription>
                  {pendingPlan ? "Cadastro rápido — só e-mail e senha." : "Comece hoje mesmo a avaliar imóveis com IA."}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSignUp}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mail</Label>
                    <Input id="signup-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                  <Button type="submit" className="w-full bg-brand-gold text-primary-foreground" disabled={isLoading}>
                    {isLoading ? "Criando..." : pendingPlan ? "Continuar para pagamento" : "Criar Conta"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
