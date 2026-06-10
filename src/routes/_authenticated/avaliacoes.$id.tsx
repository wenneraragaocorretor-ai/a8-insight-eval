import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getAvaliacaoDetalhe } from "../../lib/avaliacoes.functions";
import { getMapaEstatico } from "../../lib/mapa.functions";
import { gerarMarketingAvaliacao, type MarketingResultado } from "../../lib/marketing.functions";
import { modelosDisponiveis, type ModeloPdf } from "../../lib/pdfReport";
import { supabase } from "../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ChevronLeft, TrendingUp, TrendingDown, Target, ShieldAlert, Download, Lock, Sparkles, Users, Megaphone, FileText, Copy } from "lucide-react";




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
  const { avaliacao, resultado, comparaveis, profile } = Route.useLoaderData();
  const rel = resultado?.relatorio_json || {};
  const navigate = useNavigate();

  const plano = (profile?.plano ?? "basico") as string;
  const disponiveis = modelosDisponiveis(plano);
  const todosModelos: { id: ModeloPdf; nome: string }[] = [
    { id: 1, nome: "Modelo 1 — Estudo Simplificado" },
    { id: 2, nome: "Modelo 2 — Estudo Completo" },
    { id: 3, nome: "Modelo 3 — Laudo ABNT NBR 14653-2" },
  ];
  const [modelo, setModelo] = useState<ModeloPdf>(disponiveis[disponiveis.length - 1]);

  const fetchMapa = useServerFn(getMapaEstatico);
  const fetchMarketing = useServerFn(gerarMarketingAvaliacao);
  const [marketing, setMarketing] = useState<MarketingResultado | null>(null);
  const [loadingMkt, setLoadingMkt] = useState(false);

  const handleGerarMarketing = async () => {
    if (loadingMkt) return;
    setLoadingMkt(true);
    try {
      const res = await fetchMarketing({ data: { id: avaliacao.id } });
      setMarketing(res);
      toast.success("Plano de marketing gerado");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar marketing");
    } finally {
      setLoadingMkt(false);
    }
  };

  const copiar = async (texto: string, label: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const handleDownload = async () => {
    if (!disponiveis.includes(modelo)) {
      toast.error("Faça upgrade para acessar este relatório", {
        action: { label: "Ver planos", onClick: () => navigate({ to: "/planos" }) },
      });
      return;
    }
    // Carrega fotos do imóvel (paths privados → dataURL) para embutir no PDF
    const fotosPaths: string[] = Array.isArray((avaliacao as any)?.fotos) ? (avaliacao as any).fotos : [];
    const fotosMeta: Array<{ path: string; legenda?: string; principal?: boolean; comentario_ia?: string }> =
      Array.isArray((avaliacao as any)?.fotos_meta) ? (avaliacao as any).fotos_meta : [];
    const fotosDataUrls: string[] = [];
    const fotosDetalhadas: Array<{ dataUrl: string; legenda: string; principal: boolean; comentario_ia: string }> = [];
    for (const p of fotosPaths.slice(0, 15)) {
      try {
        const { data: blob, error } = await supabase.storage.from("avaliacoes-fotos").download(p);
        if (error || !blob) continue;
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        fotosDataUrls.push(dataUrl);
        const meta = fotosMeta.find((m) => m.path === p);
        fotosDetalhadas.push({
          dataUrl,
          legenda: meta?.legenda ?? "",
          principal: !!meta?.principal,
          comentario_ia: meta?.comentario_ia ?? "",
        });
      } catch (e) {
        console.error("Falha ao carregar foto para o PDF:", e);
      }
    }
    // Carrega o logo do corretor (bucket privado "logos")
    let logoDataUrl: string | null = null;
    const logoPath = (profile as any)?.logo_url;
    if (logoPath) {
      try {
        const { data: blob } = await supabase.storage.from("logos").download(logoPath);
        if (blob) {
          logoDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.error("Falha ao carregar logo:", e);
      }
    }
    // Mapa estático via OpenStreetMap (apenas no laudo Expert / Modelo 3)
    let mapaDataUrl: string | null = null;
    if (modelo === 3) {
      const endereco =
        String((avaliacao as any)?.endereco_completo || "").trim() ||
        String((avaliacao as any)?.localizacao || "").trim();
      if (endereco) {
        try {
          const res = await fetchMapa({ data: { endereco } });
          if (res && (res as any).ok) mapaDataUrl = (res as any).dataUrl;
        } catch (e) {
          console.error("Falha ao gerar mapa OSM:", e);
        }
      }
    }
    // Marketing (Plano Expert / Modelo 3) — gera silenciosamente se ainda não houver
    let marketingForPdf: MarketingResultado | null = marketing;
    if (modelo === 3 && !marketingForPdf) {
      try {
        marketingForPdf = await fetchMarketing({ data: { id: avaliacao.id } });
        setMarketing(marketingForPdf);
      } catch (e) {
        console.error("Falha ao gerar marketing:", e);
      }
    }
    const { gerarPdfAvaliacao } = await import("../../lib/pdfReport");
    gerarPdfAvaliacao(avaliacao, resultado, comparaveis, {
      modelo,
      plano,
      fotosDataUrls,
      fotosDetalhadas,
      mapaDataUrl,
      marketing: marketingForPdf,
      corretor: {
        nome: profile?.nome ?? "Corretor",
        creci: profile?.creci ?? null,
        cnai: (profile as any)?.cnai ?? null,
        outro_registro: (profile as any)?.outro_registro ?? null,
        telefone: profile?.telefone ?? null,
        cidade: profile?.cidade ?? null,
        estado: profile?.estado ?? null,
        email: (profile as any)?.email ?? null,
        nome_imobiliaria: (profile as any)?.nome_imobiliaria ?? null,
        logo_data_url: logoDataUrl,
      },
    });
  };


  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ChevronLeft size={16} /> Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-brand-blue mt-2">Resultado da Avaliação</h1>
          <p className="text-muted-foreground">
            {avaliacao?.tipo_imovel} • {avaliacao?.localizacao} • {avaliacao?.area_total} m²
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Select value={String(modelo)} onValueChange={(v) => setModelo(Number(v) as ModeloPdf)}>
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {todosModelos.map((m) => {
                const bloqueado = !disponiveis.includes(m.id);
                return (
                  <SelectItem key={m.id} value={String(m.id)} disabled={bloqueado}>
                    <span className="flex items-center gap-2">
                      {bloqueado && <Lock size={12} />} {m.nome}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button onClick={handleDownload} className="gap-2 bg-brand-gold text-primary-foreground">
            <Download size={16} /> Baixar PDF
          </Button>
        </div>
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
        "Esta avaliação é mercadológica e não substitui laudo técnico aprovado por profissional habilitado (CNAI/IBAPE)"
      </p>
    </div>
  );
}
