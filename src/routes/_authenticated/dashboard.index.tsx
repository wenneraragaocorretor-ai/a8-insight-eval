import { createFileRoute } from "@tanstack/react-router";
import { useRouteContext } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, History, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const nome = user.user_metadata?.nome || user.email?.split("@")[0];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-blue">Olá, {nome}</h1>
          <p className="text-muted-foreground">Bem-vindo ao seu painel de avaliações.</p>
        </div>
        <Button className="bg-brand-gold text-primary-foreground gap-2 h-12 px-6 rounded-xl shadow-lg hover:scale-105 transition-transform">
          <Plus size={20} />
          Nova Avaliação
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="premium-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avaliações no Mês</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 / 3</div>
            <p className="text-xs text-muted-foreground">Plano Gratuito</p>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Laudos Gerados</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
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
        <Card className="premium-card bg-muted/30 border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-background p-4 rounded-full mb-4">
              <FileText className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-muted-foreground">Você ainda não realizou nenhuma avaliação.</p>
            <Button variant="link" className="text-brand-blue font-semibold mt-2">Começar agora</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
