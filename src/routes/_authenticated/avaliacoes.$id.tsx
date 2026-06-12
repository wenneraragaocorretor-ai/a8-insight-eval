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
import { ChevronLeft, TrendingUp, TrendingDown, Target, ShieldAlert, Download, Lock, Sparkles, Users, Megaphone, FileText, Copy, Pencil } from "lucide-react";
import { limiteEdicoesPorPlano } from "../../lib/avaliacoes.functions";
import { ExpertChat } from "../../components/ExpertChat";




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
          const res = await fetchMapa({
            data: {
              endereco,
              cidade: (profile as any)?.cidade || undefined,
              estado: (profile as any)?.estado || undefined,
            },
          });
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
    await gerarPdfAvaliacao(avaliacao, resultado, comparaveis, {
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
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="text-3xl font-bold text-brand-blue">Resultado da Avaliação</h1>
            {(avaliacao as any)?.editado && (
              <span className="text-xs font-semibold uppercase tracking-wide bg-brand-gold text-white px-2 py-1 rounded">
                Atualizado
              </span>
            )}
          </div>
          <p className="text-muted-foreground">
            {avaliacao?.tipo_imovel} • {avaliacao?.localizacao} • {avaliacao?.area_total} m²
          </p>
          {(avaliacao as any)?.ultima_edicao_em && (
            <p className="text-xs text-muted-foreground mt-1">
              Última edição em{" "}
              {new Date((avaliacao as any).ultima_edicao_em).toLocaleDateString("pt-BR", {
                day: "2-digit", month: "short", year: "numeric",
              })}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-end gap-2 flex-wrap">
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
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/avaliacoes/nova", search: { edit: avaliacao.id } as any })}
              className="gap-2 border-[#0F2D5C] text-[#0F2D5C] hover:bg-[#0F2D5C] hover:text-white"
              disabled={(() => {
                const lim = limiteEdicoesPorPlano(plano);
                return lim !== null && ((avaliacao as any)?.edicoes_count ?? 0) >= lim;
              })()}
            >
              <Pencil size={16} /> Editar Laudo
            </Button>
            <Button onClick={handleDownload} className="gap-2 bg-brand-gold text-primary-foreground">
              <Download size={16} /> Baixar PDF
            </Button>
          </div>
          {(() => {
            const lim = limiteEdicoesPorPlano(plano);
            const usadas = (avaliacao as any)?.edicoes_count ?? 0;
            if (lim === null) {
              return <span className="text-xs text-muted-foreground">Edições ilimitadas (Expert)</span>;
            }
            const restantes = Math.max(0, lim - usadas);
            return (
              <span className="text-xs text-muted-foreground">
                {restantes > 0 ? `${restantes} edição(ões) restante(s)` : "Limite de edições atingido"}
              </span>
            );
          })()}
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
              {comparaveis.map((c: any) => {
                const tn = String(avaliacao?.tipo_imovel ?? "").toLowerCase();
                const priv = Number(c.area_privativa);
                const total = Number(c.area);
                const areaBase = tn.includes("terreno")
                  ? total
                  : (Number.isFinite(priv) && priv > 0 ? priv : total);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.fonte}</TableCell>
                    <TableCell>{c.localizacao || "—"}</TableCell>
                    <TableCell className="text-right">{c.area}</TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(c.valor_anunciado))}</TableCell>
                    <TableCell className="text-right">
                      {areaBase > 0 ? fmtBRL(Number(c.valor_anunciado) / areaBase) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
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

      {/* ============ ASSISTENTE DE MARKETING (somente Expert) ============ */}
      {plano === "expert" && (
      <Card className="premium-card border-brand-gold">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="text-brand-gold" size={20} />
            Assistente de Marketing
          </CardTitle>
          {!marketing && (
            <Button
              onClick={handleGerarMarketing}
              disabled={loadingMkt}
              className="bg-brand-gold text-primary-foreground gap-2"
            >
              <Sparkles size={16} />
              {loadingMkt ? "Gerando..." : "Gerar com IA"}
            </Button>
          )}
          {marketing && (
            <Button variant="outline" size="sm" onClick={handleGerarMarketing} disabled={loadingMkt}>
              {loadingMkt ? "Atualizando..." : "Regenerar"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!marketing && !loadingMkt && (
            <p className="text-sm text-muted-foreground">
              Gere um plano de marketing personalizado com perfil do público-alvo, estratégia de divulgação e textos prontos para portais e redes sociais.
            </p>
          )}
          {marketing && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* CARD 1 — Público */}
              <Card className="bg-muted/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users size={16} className="text-brand-gold" /> Público-Alvo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div><span className="font-semibold">Faixa etária:</span> {marketing.publico.faixa_etaria}</div>
                  <div><span className="font-semibold">Perfil familiar:</span> {marketing.publico.perfil_familiar}</div>
                  <div><span className="font-semibold">Renda:</span> {marketing.publico.faixa_renda}</div>
                  <div><span className="font-semibold">Estilo de vida:</span> {marketing.publico.estilo_vida}</div>
                  <div><span className="font-semibold">Motivação:</span> {marketing.publico.motivacao_compra}</div>
                </CardContent>
              </Card>

              {/* CARD 2 — Divulgação */}
              <Card className="bg-muted/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Megaphone size={16} className="text-brand-gold" /> Estratégia de Divulgação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold">Canais:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {marketing.divulgacao.canais.map((c, i) => (
                        <span key={i} className="text-xs bg-brand-blue text-white px-2 py-0.5 rounded">{c}</span>
                      ))}
                    </div>
                  </div>
                  <div><span className="font-semibold">Melhor horário:</span> {marketing.divulgacao.melhor_horario}</div>
                  <div><span className="font-semibold">Prazo de venda:</span> {marketing.divulgacao.prazo_venda}</div>
                  <div><span className="font-semibold">Precificação:</span> {marketing.divulgacao.dicas_precificacao}</div>
                  <div><span className="font-semibold">Desconto máx:</span> {marketing.divulgacao.desconto_maximo}</div>
                </CardContent>
              </Card>

              {/* CARD 3 — Anúncio */}
              <Card className="bg-muted/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText size={16} className="text-brand-gold" /> Texto de Anúncio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Título</span>
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copiar(marketing.anuncio.titulo, "Título")}>
                        <Copy size={12} />
                      </Button>
                    </div>
                    <p className="text-xs bg-background p-2 rounded border">{marketing.anuncio.titulo}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Descrição (portais)</span>
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copiar(marketing.anuncio.descricao_portal, "Descrição")}>
                        <Copy size={12} />
                      </Button>
                    </div>
                    <p className="text-xs bg-background p-2 rounded border whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {marketing.anuncio.descricao_portal}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">WhatsApp</span>
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copiar(marketing.anuncio.whatsapp, "Texto WhatsApp")}>
                        <Copy size={12} />
                      </Button>
                    </div>
                    <p className="text-xs bg-background p-2 rounded border whitespace-pre-wrap">{marketing.anuncio.whatsapp}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Hashtags</span>
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copiar(marketing.anuncio.hashtags.join(" "), "Hashtags")}>
                        <Copy size={12} />
                      </Button>
                    </div>
                    <p className="text-xs bg-background p-2 rounded border text-brand-blue font-medium">
                      {marketing.anuncio.hashtags.join(" ")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
      )}


      <p className="text-xs text-center text-muted-foreground italic">
        "Esta avaliação é mercadológica e não substitui laudo técnico aprovado por profissional habilitado (CNAI/IBAPE)"
      </p>
      <ExpertChat plano={plano} avaliacaoId={avaliacao?.id} />
    </div>
  );
}
