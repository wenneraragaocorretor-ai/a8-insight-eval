import { createFileRoute, Link } from "@tanstack/react-router";
import { getAvaliacaoDetalhe } from "../../lib/avaliacoes.functions";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { ChevronLeft, TrendingUp, TrendingDown, Target, ShieldAlert, Download } from "lucide-react";


export const Route = createFileRoute("/_authenticated/avaliacoes/$id")({
  loader: async ({ params }) => {
    return await getAvaliacaoDetalhe({ data: { id: params.id } });
  },
  errorComponent: ({ error }) => {
    const isUnauthorized = error.message?.includes("permissão") || error.message?.includes("permissao");
    return (
      <div className="p-8 text-center">
        {isUnauthorized ? (
          <>
            <ShieldAlert className="mx-auto h-10 w-10 text-destructive mb-3" />
            <h2 className="text-xl font-bold text-destructive">Acesso Negado</h2>
            <p className="text-muted-foreground mt-2">{error.message}</p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-destructive">Erro ao carregar avaliação</h2>
            <p className="text-muted-foreground mt-2">{error.message}</p>
          </>
        )}
        <Link to="/dashboard"><Button className="mt-4">Voltar ao Dashboard</Button></Link>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <h2 className="text-xl font-bold">Avaliação não encontrada</h2>
      <Link to="/dashboard"><Button className="mt-4">Voltar ao Dashboard</Button></Link>
    </div>
  ),
  component: AvaliacaoDetalhe,
});

const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function AvaliacaoDetalhe() {
  const { avaliacao, resultado, comparaveis } = Route.useLoaderData();
  const rel = resultado?.relatorio_json || {};

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ChevronLeft size={16} /> Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-brand-blue mt-2">Resultado da Avaliação</h1>
          <p className="text-muted-foreground">
            {avaliacao?.tipo_imovel} • {avaliacao?.localizacao} • {avaliacao?.area_total} m²
          </p>
        </div>
        <Button onClick={() => gerarPdfAvaliacao(avaliacao, resultado, comparaveis)} className="gap-2 bg-brand-gold text-primary-foreground">
          <Download size={16} /> Baixar PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="premium-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingDown size={16} /> Valor Mínimo</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtBRL(resultado?.valor_minimo)}</div></CardContent>
        </Card>
        <Card className="premium-card border-brand-gold">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Target size={16} /> Valor Central</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-brand-gold">{fmtBRL(resultado?.valor_central)}</div>
            {resultado?.valor_unitario_medio && (
              <p className="text-xs text-muted-foreground mt-1">{fmtBRL(resultado.valor_unitario_medio)}/m²</p>
            )}
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp size={16} /> Valor Máximo</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtBRL(resultado?.valor_maximo)}</div></CardContent>
        </Card>
      </div>

      {rel.analise && (
        <Card className="premium-card">
          <CardHeader><CardTitle>Análise de Mercado</CardTitle></CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
              {typeof rel.analise === "string" ? rel.analise : JSON.stringify(rel.analise, null, 2)}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="premium-card">
        <CardHeader><CardTitle>Comparáveis Utilizados</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fonte</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead className="text-right">Área (m²)</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">R$/m²</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparaveis.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.fonte}</TableCell>
                  <TableCell>{c.localizacao || "—"}</TableCell>
                  <TableCell className="text-right">{c.area}</TableCell>
                  <TableCell className="text-right">{fmtBRL(Number(c.valor_anunciado))}</TableCell>
                  <TableCell className="text-right">
                    {c.area > 0 ? fmtBRL(Number(c.valor_anunciado) / Number(c.area)) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(rel.dicas || rel.recomendacoes) && (
        <Card className="premium-card">
          <CardHeader><CardTitle>Dicas e Recomendações</CardTitle></CardHeader>
          <CardContent>
            {Array.isArray(rel.dicas || rel.recomendacoes) ? (
              <ul className="list-disc pl-5 space-y-2">
                {(rel.dicas || rel.recomendacoes).map((d: string, i: number) => (
                  <li key={i} className="text-sm">{d}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{String(rel.dicas || rel.recomendacoes)}</p>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-center text-muted-foreground italic">
        "Esta avaliação é mercadológica e não substitui laudo técnico assinado por profissional habilitado (CNAI/IBAPE)"
      </p>
    </div>
  );
}
