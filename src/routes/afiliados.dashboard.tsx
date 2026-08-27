import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { getAfiliadoDashboard } from "../lib/afiliado.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, LogOut, Users, Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/afiliados/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/afiliados/login" });
    }
  },
  component: AfiliadosDashboardPage,
  head: () => ({
    meta: [{ title: "Painel do Afiliado — A8 Avalia" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold text-destructive">Acesso negado</h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/afiliados/login";
          }}
        >
          Voltar ao login
        </Button>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Não encontrado.</div>,
});

const PLANO_LABEL: Record<string, string> = {
  basico: "Básico",
  profissional: "Profissional",
  expert: "Expert",
};

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("pt-BR");
}

function AfiliadosDashboardPage() {
  const fetchDash = useServerFn(getAfiliadoDashboard);
  const { data, isLoading, error } = useQuery({
    queryKey: ["afiliado-dashboard"],
    queryFn: fetchDash,
  });
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Carregando…</div>;
  }
  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-4">
        <p className="text-destructive font-medium">{(error as Error).message}</p>
        <Button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/afiliados/login";
          }}
        >
          Voltar ao login
        </Button>
      </div>
    );
  }
  if (!data) return null;

  const { afiliado, indicacoes } = data;
  const link = `${window.location.origin}/?ref=${afiliado.codigo}`;
  const totalConv = indicacoes.length;
  const pendentes = indicacoes
    .filter((i) => i.status === "pendente")
    .reduce((s, i) => s + i.valor_comissao, 0);
  const pagas = indicacoes
    .filter((i) => i.status === "pago")
    .reduce((s, i) => s + i.valor_comissao, 0);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  async function sair() {
    await supabase.auth.signOut();
    window.location.href = "/afiliados/login";
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-bold text-xl text-brand-blue">
            A8 <span className="text-brand-gold">Avalia</span>{" "}
            <span className="text-sm font-normal text-muted-foreground">· Afiliados</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Olá, <strong className="text-foreground">{afiliado.nome}</strong>
            </span>
            <Button variant="ghost" size="sm" onClick={sair}>
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <section>
          <h1 className="text-2xl font-bold text-brand-blue mb-1">Painel do Afiliado</h1>
          <p className="text-sm text-muted-foreground">
            Compartilhe seu link e acompanhe suas comissões. Você ganha{" "}
            {afiliado.percentual_comissao}% sobre o primeiro pagamento de cada indicação.
          </p>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seu link de indicação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={link}
                  className="font-mono text-sm"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button onClick={copiar} variant={copied ? "secondary" : "default"}>
                  <Copy className="h-4 w-4 mr-1" /> {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Código: <strong className="font-mono">{afiliado.codigo}</strong>
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <Users className="h-4 w-4" /> Indicações convertidas
              </div>
              <div className="text-3xl font-bold text-brand-blue">{totalConv}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <Clock className="h-4 w-4" /> Comissões pendentes
              </div>
              <div className="text-3xl font-bold text-amber-600">{fmtMoney(pendentes)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <CheckCircle2 className="h-4 w-4" /> Comissões pagas
              </div>
              <div className="text-3xl font-bold text-emerald-600">{fmtMoney(pagas)}</div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Minhas indicações</CardTitle>
            </CardHeader>
            <CardContent>
              {indicacoes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhuma indicação convertida ainda. Compartilhe seu link para começar.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Data</th>
                        <th className="py-2 pr-4 font-medium">Indicado</th>
                        <th className="py-2 pr-4 font-medium">Plano</th>
                        <th className="py-2 pr-4 font-medium text-right">Valor pago</th>
                        <th className="py-2 pr-4 font-medium text-right">Comissão</th>
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicacoes.map((i) => (
                        <tr key={i.id} className="border-b last:border-0">
                          <td className="py-3 pr-4">{fmtDate(i.created_at)}</td>
                          <td className="py-3 pr-4 font-mono text-xs">{i.email_mascarado}</td>
                          <td className="py-3 pr-4">{PLANO_LABEL[i.plano] ?? i.plano}</td>
                          <td className="py-3 pr-4 text-right">{fmtMoney(i.valor_pago)}</td>
                          <td className="py-3 pr-4 text-right font-medium">
                            {fmtMoney(i.valor_comissao)}
                          </td>
                          <td className="py-3">
                            {i.status === "pago" ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-600">Pago</Badge>
                            ) : (
                              <Badge className="bg-amber-500 hover:bg-amber-500">Pendente</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
