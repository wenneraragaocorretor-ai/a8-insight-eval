import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRouteContext } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { FileText, Plus, History, Trophy, Eye, CheckCircle2, AlertTriangle, User, Pencil, Receipt } from "lucide-react";
import { toast } from "sonner";
import { listarAvaliacoes } from "../../lib/avaliacoes.functions";
import { getMeuPerfil } from "../../lib/perfil.functions";
import { getStatusAssinatura, confirmarCheckout, listarCobrancasAvulsas } from "../../lib/stripe.functions";
import { ExpertChat } from "../../components/ExpertChat";

type DashboardSearch = { session_id?: string; pagamento?: string };

export const Route = createFileRoute("/_authenticated/dashboard/")({
  validateSearch: (s: Record<string, unknown>): DashboardSearch => ({
    session_id: s.session_id as string | undefined,
    pagamento: s.pagamento as string | undefined,
  }),
  component: Dashboard,
});

const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const PLAN_LABEL: Record<string, string> = {
  basico: "Básico",
  profissional: "Profissional",
  user: "Básico",
  pro: "Profissional",
  expert: "Expert",
  expert_extra: "Expert (Laudo Avulso)",
};

function Dashboard() {
  const context = useRouteContext({ from: "/_authenticated" });
  const user = (context as any)?.user;
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listarAvaliacoes);
  const fetchStatus = useServerFn(getStatusAssinatura);
  const fetchPerfil = useServerFn(getMeuPerfil);
  const fetchCobrancas = useServerFn(listarCobrancasAvulsas);
  const confirmFn = useServerFn(confirmarCheckout);
  const [welcomePlano, setWelcomePlano] = useState<string | null>(null);
  const confirmedRef = useRef(false);
  const initialConfirming =
    !!search.session_id || search.pagamento === "sucesso" || search.pagamento === "ok";
  const [confirming, setConfirming] = useState(initialConfirming);
  const [confirmMessage, setConfirmMessage] = useState("Atualizando seu plano...");

  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ["avaliacoes-list"],
    queryFn: () => fetchList(),
  });
  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["assinatura-status"],
    queryFn: () => fetchStatus(),
  });
  const { data: perfilData } = useQuery({
    queryKey: ["meu-perfil"],
    queryFn: () => fetchPerfil(),
  });
  const { data: cobrancasExtras = [] } = useQuery({
    queryKey: ["cobrancas-avulsas"],
    queryFn: () => fetchCobrancas(),
  });
  const perfilIncompleto = !!perfilData && !perfilData.profile?.telefone;

  useEffect(() => {
    const sid = search.session_id;
    const triggered = sid || search.pagamento === "sucesso" || search.pagamento === "ok";
    if (!triggered || confirmedRef.current) return;
    confirmedRef.current = true;
    setConfirming(true);

    const run = async () => {
      // Captura plano atual como baseline para detectar mudança
      const baselineRes = await refetchStatus();
      const baselinePlano: string | null = (baselineRes.data as any)?.plano ?? null;
      console.log("[checkout] plano baseline:", baselinePlano);

      let plano: string = "basico";
      let isPayment = false;
      if (sid) {
        try {
          const res: any = await Promise.race([
            confirmFn({ data: { session_id: sid } }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("timeout-confirm")), 10000),
            ),
          ]);
          if (res?.plano) plano = res.plano;
          isPayment = plano === "basico" || plano === "expert_extra";
          console.log("[checkout] confirmarCheckout retornou:", { plano, isPayment });
        } catch (e) {
          console.error("[confirmarCheckout]", e);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["assinatura-status"] });
      await queryClient.invalidateQueries({ queryKey: ["cobrancas-avulsas"] });

      // Polling: até 20× a cada 500ms aguardando plano refletir no Supabase
      let detected: string | null = null;
      let assinaturaAtivaOk = false;
      let creditosOk = false;
      let planoMudou = false;
      for (let i = 0; i < 20; i++) {
        const r = await refetchStatus();
        const d: any = r.data;
        if (d?.plano) {
          detected = d.plano;
          assinaturaAtivaOk = !!d.assinaturaAtiva;
          creditosOk = (d.creditosAvulsos ?? 0) > 0;
          planoMudou = detected !== baselinePlano;
          console.log("[checkout] poll", i, { detected, assinaturaAtivaOk, creditosOk, planoMudou });
          if (isPayment ? creditosOk : (assinaturaAtivaOk && detected !== "basico" && detected !== "user")) {
            break;
          }
        }
        await new Promise((res) => setTimeout(res, 500));
      }


      const sucesso = isPayment ? creditosOk : (assinaturaAtivaOk && !!detected);
      if (sucesso) {
        if (isPayment && plano === "expert_extra") {
          setWelcomePlano("Expert (Laudo Avulso)");
          toast.success("Pagamento confirmado! +1 laudo Expert adicional disponível.");
        } else if (isPayment) {
          setWelcomePlano("Básico");
          toast.success("Compra confirmada! +1 laudo Básico disponível.");
        } else {
          const label = PLAN_LABEL[detected!] ?? PLAN_LABEL[plano] ?? "Plano";
          setWelcomePlano(label);
          toast.success(`Plano ${label} ativado com sucesso!`);
        }
      } else {
        setConfirmMessage("Pagamento recebido! Seu plano será ativado em instantes.");
        toast.message("Pagamento recebido! Seu plano será ativado em instantes.");
        await new Promise((res) => setTimeout(res, 1500));
      }

      await refetchStatus();
      setConfirming(false);
      navigate({ to: "/dashboard", search: {}, replace: true });
    };
    void run();
  }, [search.session_id, search.pagamento]);

  // Guard de acesso: sem assinatura ativa E sem créditos avulsos → /planos.
  useEffect(() => {
    if (!status) return;
    if (confirming) return; // aguardando confirmação de checkout
    if (search.session_id || search.pagamento) return;
    const creditos = (status as any)?.creditosAvulsos ?? 0;
    if (!status.assinaturaAtiva && creditos <= 0) {
      navigate({ to: "/planos", replace: true });
    }
  }, [status, confirming, search.session_id, search.pagamento, navigate]);

  if (!user) return null;

  if (confirming) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="mx-auto h-12 w-12 rounded-full border-4 border-brand-blue/20 border-t-brand-blue animate-spin" />
          <h2 className="text-xl font-semibold text-brand-blue">{confirmMessage}</h2>
          <p className="text-sm text-muted-foreground">
            Não feche esta janela. Estamos ativando seu plano com segurança.
          </p>
        </div>
      </div>
    );
  }
  const nome = perfilData?.profile?.nome || user.user_metadata?.nome || user.email?.split("@")[0];
  const ehAdmin = !!(status as any)?.isAdmin;
  const planoLabel = ehAdmin
    ? "Administrador (acesso total ilimitado)"
    : status?.plano ? (PLAN_LABEL[status.plano] ?? "—") : "—";
  const planoCode = status?.plano ?? null;
  const ehBasico = !ehAdmin && (planoCode === "basico" || planoCode === "user");
  const ehExpert = !ehAdmin && planoCode === "expert";
  const usadas = status?.avaliacoesMes ?? 0;
  const limite = status?.limiteMes;
  const creditos = (status as any)?.creditosAvulsos ?? 0;
  const ativa = status?.assinaturaAtiva;
  // Só mostra "limite atingido" para usuários COM plano ativo. Admin nunca atinge limite.
  const temPlanoAtivo = !ehAdmin && !!planoCode && !!ativa;
  const ehProfissional = !ehAdmin && (planoCode === "profissional" || planoCode === "pro");
  const limiteAtingido = temPlanoAtivo && (
    ehBasico
      ? creditos <= 0
      : ehProfissional && limite != null && usadas >= limite
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-blue">Olá, {nome}</h1>
          <p className="text-muted-foreground">Bem-vindo ao seu painel de avaliações.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/perfil">
            <Button variant="outline" className="gap-2 h-12 px-5 rounded-xl">
              <User size={16} /> Meu Perfil
            </Button>
          </Link>
          <Link to="/planos">
            <Button variant="outline" className="gap-2 h-12 px-5 rounded-xl">
              Planos
            </Button>
          </Link>
          <Link to="/avaliacoes/nova">
            <Button className="bg-brand-gold text-primary-foreground gap-2 h-12 px-6 rounded-xl shadow-lg hover:scale-105 transition-transform">
              <Plus size={20} />
              Nova Avaliação
            </Button>
          </Link>
        </div>
      </div>

      {perfilIncompleto && (
        <Card className="premium-card border-2 border-yellow-400 bg-yellow-50">
          <CardContent className="flex flex-col md:flex-row items-start md:items-center gap-3 py-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-yellow-900">Complete seu perfil</p>
              <p className="text-sm text-yellow-800">
                Adicione telefone para que seus dados apareçam nos laudos gerados.
              </p>
            </div>
            <Link to="/perfil">
              <Button className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950">Completar agora</Button>
            </Link>
          </CardContent>
        </Card>
      )}


      {welcomePlano && (
        <Card className="premium-card border-2 border-brand-gold bg-brand-gold/5">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-6 w-6 text-brand-gold shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-brand-blue">Pagamento confirmado!</p>
              <p className="text-sm text-muted-foreground">
                {welcomePlano === "Básico"
                  ? "+1 laudo Básico disponível na sua conta."
                  : `Sua assinatura do Plano ${welcomePlano} está ativa. Aproveite!`}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setWelcomePlano(null)}>Fechar</Button>
          </CardContent>
        </Card>
      )}



      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="premium-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {ehAdmin ? "Avaliações no Mês" : ehBasico ? "Laudos Avulsos" : "Avaliações no Mês"}
            </CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ehAdmin
                ? `${usadas} (ilimitado)`
                : ehBasico
                  ? `${creditos} disponível${creditos === 1 ? "" : "s"}`
                  : ehExpert
                    ? `${usadas} / ${limite ?? 20}`
                    : `${usadas} / ${limite ?? 8}`}
            </div>
            <p className="text-xs text-muted-foreground">
              {ehAdmin ? "Sem limite mensal" : ehBasico ? "Crédito por compra (R$ 157)" : "Mês atual"}
            </p>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plano Atual</CardTitle>
            <Trophy className="h-4 w-4 text-brand-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{planoLabel}</div>
            <p className="text-xs text-muted-foreground">
              {ehAdmin ? "Acesso total a todos os recursos, sem cobrança" : ehBasico ? (
                <Link to="/planos" className="text-brand-gold font-medium hover:underline">
                  Comprar laudo / fazer upgrade
                </Link>
              ) : ativa ? "Assinatura ativa" : (
                <Link to="/planos" className="text-brand-gold font-medium hover:underline">
                  Assinar plano
                </Link>
              )}
            </p>
            {ehAdmin && <AdminModeloSelector />}
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
      </div>

      {ehExpert && (() => {
        const limExpert = limite ?? 20;
        const restantes = Math.max(0, limExpert - usadas);
        const pct = Math.min(100, (usadas / limExpert) * 100);
        const atingiu = usadas >= limExpert;
        const proximo = !atingiu && restantes <= 2;
        const barColor = atingiu ? "bg-orange-500" : proximo ? "bg-yellow-500" : "bg-brand-gold";
        return (
          <Card className="premium-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base text-brand-blue">Uso mensal do Plano Expert</CardTitle>
                <span className="text-sm font-semibold text-brand-blue">
                  Laudos utilizados: {usadas} / {limExpert}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              {atingiu && (
                <div className="flex items-start gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-900">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span><strong>Limite atingido</strong> — próximos laudos: <strong>R$ 12,00/cada</strong>.{creditos > 0 ? ` Você tem ${creditos} crédito(s) avulso(s) disponível(eis).` : ""}</span>
                </div>
              )}
              {proximo && (
                <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Você está próximo do limite — <strong>{restantes} laudo(s) restante(s)</strong>.</span>
                </div>
              )}
              {cobrancasExtras.filter((c: any) => c.tipo === "expert_extra").length > 0 && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-brand-blue">
                    <Receipt className="h-4 w-4" /> Histórico de laudos adicionais
                  </div>
                  <ul className="space-y-1 text-sm">
                    {cobrancasExtras
                      .filter((c: any) => c.tipo === "expert_extra")
                      .slice(0, 10)
                      .map((c: any) => (
                        <li key={c.id} className="flex items-center justify-between text-muted-foreground">
                          <span>
                            {new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                            {" · "}{c.descricao ?? "Laudo adicional Expert"}
                          </span>
                          <span className="font-semibold text-brand-blue">
                            {((c.valor_cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: (c.moeda ?? "BRL").toUpperCase() })}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}


      {limiteAtingido && (
        <Card className="premium-card border-brand-gold border-2">
          <CardContent className="flex items-center justify-between py-4 gap-4">
            <div>
              <p className="font-semibold text-brand-blue">
                {ehBasico
                  ? "Você não tem laudos avulsos disponíveis"
                  : `Você atingiu o limite de ${limite ?? 8} laudos/mês do Plano Profissional`}
              </p>
              <p className="text-sm text-muted-foreground">
                {ehBasico
                  ? "Compre um novo laudo Básico (R$ 157) ou assine o Profissional/Expert."
                  : "Faça upgrade para o Expert e tenha até 20 laudos/mês."}
              </p>
            </div>
            <Link to="/planos">
              <Button className="bg-brand-gold text-primary-foreground">
                {ehBasico ? "Comprar / Fazer upgrade" : "Fazer upgrade"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-brand-blue">{a.tipo_imovel}</span>
                      <span className="text-xs text-muted-foreground">• {a.localizacao}</span>
                      {a.editado && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-brand-gold text-white px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                          <Pencil size={10} /> Revisado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(a.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      {a.ultima_edicao_em && (
                        <>
                          {" "}• editado em{" "}
                          {new Date(a.ultima_edicao_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Valor estimado</p>
                    <p className="font-bold text-brand-gold">{fmtBRL(a.valor_central)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Link to="/avaliacoes/nova" search={{ edit: a.id } as any}>
                      <Button variant="outline" size="sm" className="gap-1 border-[#0F2D5C] text-[#0F2D5C] hover:bg-[#0F2D5C] hover:text-white">
                        <Pencil size={14} /> Editar
                      </Button>
                    </Link>
                    <Link to="/avaliacoes/$id" params={{ id: a.id }}>
                      <Button variant="outline" size="sm" className="gap-1"><Eye size={14} /> Visualizar</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <ExpertChat plano={planoCode ?? undefined} />
    </div>
  );
}

export const ADMIN_PLANO_OVERRIDE_KEY = "lov_admin_plano_modelo";

function AdminModeloSelector() {
  const [valor, setValor] = useState<string>(() => {
    if (typeof window === "undefined") return "expert";
    return localStorage.getItem(ADMIN_PLANO_OVERRIDE_KEY) || "expert";
  });
  const onChange = (v: string) => {
    setValor(v);
    try { localStorage.setItem(ADMIN_PLANO_OVERRIDE_KEY, v); } catch {}
    toast.success(`Modelo de teste: ${v.charAt(0).toUpperCase() + v.slice(1)}`);
  };
  return (
    <div className="mt-3 flex items-center gap-2">
      <label className="text-xs text-muted-foreground whitespace-nowrap">Modelo de teste:</label>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs border border-input rounded-md px-2 py-1 bg-background"
      >
        <option value="basico">Básico</option>
        <option value="profissional">Profissional</option>
        <option value="expert">Expert</option>
      </select>
    </div>
  );
}
