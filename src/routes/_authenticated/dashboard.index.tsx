import { createFileRoute, Link } from "@tanstack/react-router";
import { useRouteContext } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { FileText, Plus, History, Trophy, Eye } from "lucide-react";
import { listarAvaliacoes } from "../../lib/avaliacoes.functions";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: Dashboard,
});

const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Dashboard() {
  const context = useRouteContext({ from: "/_authenticated" });
  const user = (context as any)?.user;
  const fetchList = useServerFn(listarAvaliacoes);
  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ["avaliacoes-list"],
    queryFn: () => fetchList(),
  });

  if (!user) return null;
  const nome = user.user_metadata?.nome || user.email?.split("@")[0];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-blue">Olá, {nome}</h1>
          <p className="text-muted-foreground">Bem-vindo ao seu painel de avaliações.</p>
        </div>
        <Link to="/avaliacoes/nova">
          <Button className="bg-brand-gold text-primary-foreground gap-2 h-12 px-6 rounded-xl shadow-lg hover:scale-105 transition-transform">
            <Plus size={20} />
            Nova Avaliação
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="premium-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avaliações no Mês</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avaliacoes.length} / 3</div>
            <p className="text-xs text-muted-foreground">Plano Gratuito</p>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Laudos Gerados</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avaliacoes.length}</div>
            <p className="text-xs text-muted-foreground">Total histórico</p>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Expert</CardTitle>
            <Trophy className="h-4 w-4 text-brand-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Inativo</div>
            <p className="text-xs text-muted-foreground text-brand-gold font-medium">Fazer upgrade</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-brand-blue">Últimas Avaliações</h2>
        {isLoading ? (
          <Card className="premium-card"><CardContent className="py-8 text-center text-muted-foreground">Carregando...</CardContent></Card>
        ) : avaliacoes.length === 0 ? (
          <Card className="premium-card bg-muted/30 border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-background p-4 rounded-full mb-4">
                <FileText className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
              <p className="text-muted-foreground">Você ainda não realizou nenhuma avaliação.</p>
              <Link to="/avaliacoes/nova">
                <Button variant="link" className="text-brand-blue font-semibold mt-2">Começar agora</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {avaliacoes.map((a: any) => (
              <Card key={a.id} className="premium-card">
                <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-brand-blue">{a.tipo_imovel}</span>
                      <span className="text-xs text-muted-foreground">• {a.localizacao}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(a.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Valor estimado</p>
                    <p className="font-bold text-brand-gold">{fmtBRL(a.valor_central)}</p>
                  </div>
                  <Link to="/avaliacoes/$id" params={{ id: a.id }}>
                    <Button variant="outline" size="sm" className="gap-1"><Eye size={14} /> Visualizar</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
