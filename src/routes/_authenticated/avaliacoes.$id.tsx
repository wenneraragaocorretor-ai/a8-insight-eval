import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAvaliacaoDetalhe, atualizarValorFinalCorretor } from "../../lib/avaliacoes.functions";
import { amIAdmin } from "../../lib/admin.functions";
import { ADMIN_PLANO_OVERRIDE_KEY } from "./dashboard.index";

import { gerarMarketingAvaliacao, type MarketingResultado } from "../../lib/marketing.functions";
import { modelosDisponiveis, type ModeloPdf } from "../../lib/pdfReport";
import { areaBaseDe, labelValorM2, sufixoAreaBase } from "../../lib/areaBase";
import { supabase } from "../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ChevronLeft, TrendingUp, TrendingDown, Target, ShieldAlert, Download, Lock, Sparkles, Users, Megaphone, FileText, Copy, Pencil, Save, RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { limiteEdicoesPorPlano } from "../../lib/avaliacoes.functions";
import { ExpertChat } from "../../components/ExpertChat";




export const Route = createFileRoute("/_authenticated/avaliacoes/$id")({
  loader: async ({ params }) => {
    if (params.id.startsWith("mock-")) {
      console.log("[LAUDO 11] Carregando ID de diagnóstico:", params.id);
      if (typeof window === 'undefined') {
        console.log("[LAUDO 11] SSR detectado, retornando objeto vazio temporário");
        return { avaliacao: { id: params.id }, resultado: {}, comparaveis: [], profile: {} };
      }
      const stored = sessionStorage.getItem(`mock_laudo_${params.id}`);
      if (stored) {
        console.log("[LAUDO 11.1] Dados encontrados no cache");
        return JSON.parse(stored);
      }
      console.error("[LAUDO 11.ERR] Dados de diagnóstico não encontrados");
      throw new Error("Dados da avaliação não encontrados no cache local");
    }

    return await getAvaliacaoDetalhe({ data: { id: params.id } });
  },

  errorComponent: ({ error }) => {
    console.error("[LAUDO ERR] Erro ao renderizar AvaliacaoDetalhe:", error);
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
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3" />
            <h2 className="text-xl font-bold text-destructive">Erro ao carregar laudo</h2>
            <p className="text-muted-foreground mt-2">
              Não foi possível carregar os dados desta avaliação. Pode ser que o processo de geração tenha falhado ou o registro tenha sido removido.
            </p>
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded border border-red-100 max-w-md mx-auto">
              Detalhe técnico: {error.message}
            </div>
          </>
        )}
        <div className="mt-6 flex gap-3 justify-center">
          <Link to="/dashboard"><Button variant="outline">Ir para Dashboard</Button></Link>
          <Link to="/avaliacoes/nova"><Button>Tentar Nova Avaliação</Button></Link>
        </div>
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

const fmtBRL = (v: number | null | undefined) => {
  const num = Number(v);
  if (v == null || isNaN(num)) return "—";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};

function AvaliacaoDetalhe() {
  const data = Route.useLoaderData();
  const { avaliacao, resultado, comparaveis, profile } = data || {};
  console.log("[LAUDO 11] Página do laudo carregada", { id: avaliacao?.id, hasResultado: !!resultado });
  
  if (avaliacao?.id?.startsWith("mock-") && (!resultado || Object.keys(resultado).length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-brand-gold" />
        <p className="text-muted-foreground">Finalizando carregamento do diagnóstico...</p>
        <script dangerouslySetInnerHTML={{ __html: `
          if (typeof window !== 'undefined' && !window.location.search.includes('retry')) {
            setTimeout(() => window.location.reload(), 500);
          }
        `}} />
      </div>
    );
  }

  const rel: any = (resultado?.relatorio_json as any) || {};

  const navigate = useNavigate();
  const router = useRouter();

  const planoReal = (profile?.plano ?? "basico") as string;
  const fetchAmIAdmin = useServerFn(amIAdmin);
  const [adminOverride, setAdminOverride] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetchAmIAdmin();
        if ((r as any)?.admin) {
          const v = (typeof window !== "undefined" && localStorage.getItem(ADMIN_PLANO_OVERRIDE_KEY)) || "expert";
          setAdminOverride(v);
        }
      } catch {}
    })();
  }, []);
  const plano = adminOverride ?? planoReal;
  const disponiveis = modelosDisponiveis(plano);
  const todosModelos: { id: ModeloPdf; nome: string }[] = [
    { id: 1, nome: "Modelo 1 — Estudo Simplificado" },
    { id: 2, nome: "Modelo 2 — Estudo Completo" },
    { id: 3, nome: "Modelo 3 — Laudo ABNT NBR 14653-2" },
  ];
  const [modelo, setModelo] = useState<ModeloPdf>(disponiveis[disponiveis.length - 1]);
  const disponiveisKey = disponiveis.join(",");
  useEffect(() => {
    // Sempre que o conjunto de modelos disponíveis mudar (troca de plano real
    // ou troca do override de admin no dashboard), seleciona o maior modelo
    // disponível de forma síncrona — não depende do modelo anterior estar
    // fora da lista.
    setModelo(disponiveis[disponiveis.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disponiveisKey]);

  // Campos obrigatórios para a Ficha Técnica Detalhada (Modelos 2 e 3).
  // Avaliações criadas antes do upgrade podem não ter esses dados.
  const camposExpertFaltando = (() => {
    if (modelo !== 2 && modelo !== 3) return [] as string[];
    const a: any = avaliacao;
    const faltando: string[] = [];
    if (!a?.idade_real) faltando.push("Idade real do imóvel");
    if (!a?.posicao_solar) faltando.push("Posição solar");
    if (!a?.topografia) faltando.push("Topografia");
    if (!a?.zoneamento) faltando.push("Zoneamento");
    if (!Array.isArray(a?.tipo_acabamento) || a.tipo_acabamento.length === 0) faltando.push("Tipo de acabamento");
    return faltando;
  })();

  // Valor final personalizado pelo corretor (dentro da faixa min/max do arbítrio).
  const valorCentralTecnico = Number(resultado?.valor_central) || 0;
  const valorFinalSalvo = (resultado as any)?.valor_final_corretor;
  const [valorFinalInput, setValorFinalInput] = useState<string>(
    String(Number.isFinite(Number(valorFinalSalvo)) && Number(valorFinalSalvo) > 0
      ? Number(valorFinalSalvo)
      : valorCentralTecnico),
  );
  const [savingValor, setSavingValor] = useState(false);
  const salvarValorFinal = useServerFn(atualizarValorFinalCorretor);

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

  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleDownload = async () => {
    if (generatingPdf) return;
    if (!disponiveis.includes(modelo)) {
      toast.error("Faça upgrade para acessar este relatório", {
        action: { label: "Ver planos", onClick: () => navigate({ to: "/planos" }) },
      });
      return;
    }
    if (camposExpertFaltando.length > 0) {
      toast.error(
        `Esta avaliação foi criada antes do upgrade de plano e está faltando informações para o laudo completo (${camposExpertFaltando.join(", ")}). Edite a avaliação para preencher os campos da Ficha Técnica Detalhada antes de gerar este modelo de PDF.`,
        {
          duration: 12000,
          action: {
            label: "Editar agora",
            onClick: () => navigate({ to: "/avaliacoes/nova", search: { edit: avaliacao.id } as any }),
          },
        },
      );
      return;
    }

    setGeneratingPdf(true);
    const toastId = toast.loading("Gerando PDF...");

    try {
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
      
      toast.success("PDF baixado com sucesso!", { id: toastId });
    } catch (e: any) {
      console.error("Erro ao gerar PDF:", e);
      toast.error(`Falha ao gerar PDF: ${e.message || "Erro desconhecido"}`, { id: toastId });
    } finally {
      setGeneratingPdf(false);
    }
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
          {(() => {
            const total = Number(avaliacao?.area_total);
            const base = areaBaseDe(avaliacao?.tipo_imovel, avaliacao);
            const areaTxt =
              base.area > 0
                ? `${base.area} m² (${base.label})${
                    Number.isFinite(total) && total > 0 && total !== base.area
                      ? ` | ${total} m² totais`
                      : ""
                  }`
                : `${Number.isFinite(total) ? total : 0} m²`;
            return (
              <p className="text-muted-foreground">
                {avaliacao?.tipo_imovel} • {avaliacao?.localizacao} • {areaTxt}
              </p>
            );
          })()}
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
                if (avaliacao.id.startsWith("mock-")) return true; // Bloqueado (Diagnóstico)
                const lim = limiteEdicoesPorPlano(plano);
                return lim !== null && ((avaliacao as any)?.edicoes_count ?? 0) >= lim;
              })()}
            >
              <Pencil size={16} /> {avaliacao.id.startsWith("mock-") ? "Edição bloqueada (Modo de Diagnóstico)" : "Editar Laudo"}
            </Button>

            <Button 
              onClick={handleDownload} 
              className="gap-2 bg-brand-gold text-primary-foreground"
              disabled={generatingPdf}
            >
              {generatingPdf ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Gerando PDF...
                </>
              ) : (
                <>
                  <Download size={16} /> Baixar PDF
                </>
              )}
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
            {(() => {
              const total = Number(avaliacao?.area_total);
              const base = areaBaseDe(avaliacao?.tipo_imovel, avaliacao);
              const vc = Number(resultado?.valor_central);
              const vum = Number(resultado?.valor_unitario_medio);
              const baseLabel = labelValorM2(avaliacao?.tipo_imovel).replace("Valor/m² ", "");
              const valorBase =
                Number.isFinite(vum) && vum > 0 ? vum : base.area > 0 ? vc / base.area : 0;
              const showTotalRef =
                base.fonte !== "total" &&
                Number.isFinite(total) &&
                total > 0 &&
                total !== base.area &&
                vc > 0;
              return (
                <>
                  {valorBase > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{fmtBRL(valorBase)}/m² {baseLabel}</p>
                  )}
                  {showTotalRef && (
                    <p className="text-xs text-muted-foreground">{fmtBRL(vc / total)}/m² total (referência)</p>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp size={16} /> Valor Máximo</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtBRL(resultado?.valor_maximo)}</div></CardContent>
        </Card>
      </div>

      <Card className="premium-card border-brand-gold/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Pencil size={16} /> Valor final a constar no laudo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const min = Number(resultado?.valor_minimo) || 0;
            const max = Number(resultado?.valor_maximo) || 0;
            const parsed = Number(String(valorFinalInput).replace(/\./g, "").replace(",", "."));
            const valido = Number.isFinite(parsed) && parsed >= min && parsed <= max;
            const alterado = Number.isFinite(parsed) && Math.round(parsed) !== Math.round(Number(valorFinalSalvo ?? valorCentralTecnico));
            const handleSalvar = async () => {
              if (!valido) {
                toast.error(`O valor deve estar entre ${fmtBRL(min)} e ${fmtBRL(max)} conforme o campo de arbítrio técnico (NBR 14653-2).`);
                return;
              }
              setSavingValor(true);
              try {
                await salvarValorFinal({ data: { avaliacao_id: avaliacao.id, valor_final_corretor: Math.round(parsed) } });
                toast.success("Valor final do laudo salvo");
                await router.invalidate();
              } catch (e: any) {
                toast.error(e?.message || "Falha ao salvar valor");
              } finally {
                setSavingValor(false);
              }
            };
            const handleResetar = async () => {
              setSavingValor(true);
              try {
                await salvarValorFinal({ data: { avaliacao_id: avaliacao.id, valor_final_corretor: null } });
                setValorFinalInput(String(valorCentralTecnico));
                toast.success("Valor restaurado para o cálculo técnico");
                await router.invalidate();
              } catch (e: any) {
                toast.error(e?.message || "Falha ao restaurar");
              } finally {
                setSavingValor(false);
              }
            };
            return (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={valorFinalInput}
                      onChange={(e) => setValorFinalInput(e.target.value)}
                      className="w-44 text-lg font-semibold"
                    />
                  </div>
                  <Button onClick={handleSalvar} disabled={!valido || !alterado || savingValor} className="gap-2 bg-brand-gold text-primary-foreground">
                    <Save size={16} /> Salvar
                  </Button>
                  {valorFinalSalvo != null && (
                    <Button variant="outline" onClick={handleResetar} disabled={savingValor} className="gap-2">
                      <RotateCcw size={16} /> Usar valor calculado
                    </Button>
                  )}
                </div>
                {!valido ? (
                  <p className="text-xs text-destructive">
                    O valor deve estar entre {fmtBRL(min)} e {fmtBRL(max)} conforme o campo de arbítrio técnico (NBR 14653-2).
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Faixa permitida: {fmtBRL(min)} – {fmtBRL(max)}. Valor calculado pela regressão: {fmtBRL(valorCentralTecnico)}.
                    {valorFinalSalvo != null && Math.round(Number(valorFinalSalvo)) !== Math.round(valorCentralTecnico) && (
                      <span> Valor personalizado salvo: <strong>{fmtBRL(Number(valorFinalSalvo))}</strong>.</span>
                    )}
                  </p>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>



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
                <TableHead className="text-right">
                  Área (m²){" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {sufixoAreaBase(avaliacao?.tipo_imovel)}
                  </span>
                </TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">{labelValorM2(avaliacao?.tipo_imovel).replace("Valor/m²", "R$/m²")}</TableHead>

              </TableRow>
            </TableHeader>
            <TableBody>
              {comparaveis.map((c: any) => {
                const areaBase = areaBaseDe(avaliacao?.tipo_imovel, c).area;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.fonte}</TableCell>
                    <TableCell>{c.localizacao || "—"}</TableCell>
                    <TableCell className="text-right">{areaBase}</TableCell>
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
      {String(plano ?? "").toLowerCase() !== "expert" ? (
        <Card className="premium-card border-dashed border-brand-gold/50 bg-muted/30">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <Lock size={18} className="text-brand-gold" />
              Assistente de Marketing
            </CardTitle>
            <span className="text-xs font-semibold uppercase tracking-wide bg-brand-gold/15 text-brand-gold px-2 py-1 rounded">
              Exclusivo Expert
            </span>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Disponível no plano Expert — gere perfil do público, estratégia de divulgação e textos prontos para portais e redes sociais.
            </p>
            <Button
              onClick={() => navigate({ to: "/planos" })}
              className="bg-brand-gold text-primary-foreground gap-2 shrink-0"
            >
              <Sparkles size={16} /> Fazer upgrade
            </Button>
          </CardContent>
        </Card>
      ) : (
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
