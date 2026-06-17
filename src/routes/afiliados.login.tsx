import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "../integrations/supabase/client";
import { amIAfiliado } from "../lib/afiliado.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/afiliados/login")({
  component: AfiliadosLoginPage,
  head: () => ({
    meta: [
      { title: "Login Afiliados — A8 Avalia" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AfiliadosLoginPage() {
  const navigate = useNavigate();
  const checkAfiliado = useServerFn(amIAfiliado);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Se já está logado E é afiliado, manda direto pro dashboard.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      try {
        const r = await checkAfiliado();
        if (r.afiliado) {
          throw redirect({ to: "/afiliados/dashboard" });
        }
      } catch (e: any) {
        if (e && typeof e === "object" && "to" in e) {
          navigate({ to: "/afiliados/dashboard" });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Verifica role
      const r = await checkAfiliado();
      if (!r.afiliado) {
        await supabase.auth.signOut();
        setErrMsg("Esta conta não possui acesso de afiliado.");
        setIsLoading(false);
        return;
      }
      toast.success("Bem-vindo(a)!");
      navigate({ to: "/afiliados/dashboard" });
    } catch (error: any) {
      setErrMsg(error.message || "Erro ao fazer login");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-bold text-brand-blue inline-flex items-center justify-center gap-1 mb-2">
            A8 <span className="text-brand-gold">Avalia</span>
          </Link>
          <p className="text-muted-foreground">Área do Afiliado</p>
        </div>

        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Login Afiliado</CardTitle>
            <CardDescription>Acesse sua área de afiliado para acompanhar suas indicações e comissões.</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {errMsg && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-sm px-3 py-2">
                  {errMsg}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full bg-brand-blue" disabled={isLoading}>
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
              <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">
                Não é afiliado? Acessar login normal
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
