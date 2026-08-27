import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Users, FileText, DollarSign, Loader2 } from "lucide-react";
import { getAdminStats } from "../../lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function AdminOverview() {
  const fetchStats = useServerFn(getAdminStats);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetchStats(),
  });

  if (isLoading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="premium-card">
        <CardContent className="py-8 text-sm text-destructive">
          Erro ao carregar estatísticas: {(error as Error)?.message ?? "desconhecido"}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-brand-blue">Visão Geral</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="premium-card">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de usuários
            </CardTitle>
            <Users className="h-4 w-4 text-brand-gold" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.totalUsuarios}</p>
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de laudos gerados
            </CardTitle>
            <FileText className="h-4 w-4 text-brand-gold" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.totalLaudos}</p>
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita avulsa (Stripe)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-brand-gold" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{brl(data.receitaCentavos)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Soma de cobranças avulsas pagas. Receita recorrente de assinaturas deve ser conferida
              no painel Stripe.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="text-base">Usuários por plano</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <PlanoStat label="Básico" value={data.porPlano.basico} />
            <PlanoStat label="Profissional" value={data.porPlano.profissional} />
            <PlanoStat label="Expert" value={data.porPlano.expert} />
            <PlanoStat label="Sem plano" value={data.porPlano.sem_plano} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanoStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
