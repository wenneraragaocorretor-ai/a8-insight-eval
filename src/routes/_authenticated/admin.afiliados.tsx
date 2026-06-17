import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "../../components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Plus, Copy, ChevronLeft, Power, ShieldOff } from "lucide-react";
import {
  listarAfiliadosAdmin, criarAfiliadoAdmin, atualizarAfiliadoAdmin,
  removerRoleAfiliado, getAfiliadoDetalheAdmin, marcarComissaoPaga,
} from "../../lib/afiliados-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/afiliados")({
  component: AdminAfiliadosPage,
});

const PLANO_LABEL: Record<string, string> = {
  basico: "Básico", profissional: "Profissional", expert: "Expert",
};

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-BR");
}
function gerarCodigo(nome: string) {
  const base = (nome || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8);
  const sufixo = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${base || "AFIL"}${sufixo}`;
}

function AdminAfiliadosPage() {
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  if (selecionadoId) {
    return <DetalheAfiliado id={selecionadoId} onBack={() => setSelecionadoId(null)} />;
  }
  return <ListaAfiliados onAbrir={setSelecionadoId} />;
}

function ListaAfiliados({ onAbrir }: { onAbrir: (id: string) => void }) {
  const qc = useQueryClient();
  const fetchList = useServerFn(listarAfiliadosAdmin);
  const atualizar = useServerFn(atualizarAfiliadoAdmin);
  const removerRole = useServerFn(removerRoleAfiliado);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-afiliados"],
    queryFn: fetchList,
  });

  const [showNovo, setShowNovo] = useState(false);
  const [editPctId, setEditPctId] = useState<string | null>(null);
  const [editPctVal, setEditPctVal] = useState<string>("");
  const [confirmRoleAfId, setConfirmRoleAfId] = useState<string | null>(null);

  const mutToggle = useMutation({
    mutationFn: (vars: { id: string; ativo: boolean }) =>
      atualizar({ data: { id: vars.id, ativo: vars.ativo } }),
    onSuccess: (_d, v) => {
      toast.success(v.ativo ? "Afiliado ativado" : "Afiliado desativado");
      qc.invalidateQueries({ queryKey: ["admin-afiliados"] });
      if (!v.ativo) setConfirmRoleAfId(v.id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mutPct = useMutation({
    mutationFn: (vars: { id: string; pct: number }) =>
      atualizar({ data: { id: vars.id, percentual_comissao: vars.pct } }),
    onSuccess: () => {
      toast.success("Percentual atualizado");
      setEditPctId(null);
      qc.invalidateQueries({ queryKey: ["admin-afiliados"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mutRemoverRole = useMutation({
    mutationFn: (afiliado_id: string) => removerRole({ data: { afiliado_id } }),
    onSuccess: () => {
      toast.success("Acesso de afiliado removido");
      setConfirmRoleAfId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-brand-blue">Afiliados</h2>
        <Button onClick={() => setShowNovo(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Afiliado
        </Button>
      </div>

      <Card className="premium-card">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive py-6">
              Erro ao carregar: {(error as Error).message}
            </p>
          ) : (data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum afiliado cadastrado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>% Comissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Indicações</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => onAbrir(a.id)}>
                    <TableCell className="font-medium">{a.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{a.email}</TableCell>
                    <TableCell className="font-mono text-xs">{a.codigo}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {editPctId === a.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number" min={0} max={100} step="0.01"
                            value={editPctVal}
                            onChange={(e) => setEditPctVal(e.target.value)}
                            className="h-7 w-20"
                          />
                          <Button
                            size="sm" variant="secondary"
                            disabled={mutPct.isPending}
                            onClick={() => {
                              const n = Number(editPctVal);
                              if (isNaN(n) || n < 0 || n > 100) {
                                toast.error("Valor inválido");
                                return;
                              }
                              mutPct.mutate({ id: a.id, pct: n });
                            }}
                          >OK</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditPctId(null)}>×</Button>
                        </div>
                      ) : (
                        <button
                          className="text-sm hover:underline"
                          onClick={() => { setEditPctId(a.id); setEditPctVal(String(a.percentual_comissao)); }}
                        >
                          {a.percentual_comissao}%
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={a.ativo ? "bg-emerald-600 hover:bg-emerald-600" : "bg-muted text-muted-foreground hover:bg-muted"}>
                        {a.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{a.total_indicacoes}</TableCell>
                    <TableCell className="text-right text-amber-600">{fmtMoney(a.total_pendente)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{fmtMoney(a.total_pago)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm" variant="ghost"
                        title={a.ativo ? "Desativar" : "Ativar"}
                        disabled={mutToggle.isPending}
                        onClick={() => mutToggle.mutate({ id: a.id, ativo: !a.ativo })}
                      >
                        <Power className={`h-4 w-4 ${a.ativo ? "text-emerald-600" : "text-muted-foreground"}`} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NovoAfiliadoDialog open={showNovo} onClose={() => setShowNovo(false)} />

      <AlertDialog open={!!confirmRoleAfId} onOpenChange={(o) => !o && setConfirmRoleAfId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldOff className="h-5 w-5" /> Remover acesso ao painel?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O afiliado foi desativado e não gera mais comissões. Você também quer remover
              o papel de afiliado deste usuário? Isso vai bloquear o acesso dele ao painel
              de afiliados (inclusive ao histórico).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter acesso</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRoleAfId && mutRemoverRole.mutate(confirmRoleAfId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NovoAfiliadoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const criar = useServerFn(criarAfiliadoAdmin);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pct, setPct] = useState("20");
  const [resultado, setResultado] = useState<{ codigo: string } | null>(null);
  const [codigoTocado, setCodigoTocado] = useState(false);

  const linkGerado = useMemo(
    () => resultado ? `https://a8avalia.com.br/?ref=${resultado.codigo}` : "",
    [resultado],
  );

  const mut = useMutation({
    mutationFn: () => criar({
      data: {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        codigo: codigo.trim() || gerarCodigo(nome),
        percentual_comissao: Number(pct),
      },
    }),
    onSuccess: (r) => {
      toast.success("Afiliado criado");
      qc.invalidateQueries({ queryKey: ["admin-afiliados"] });
      setResultado({ codigo: r.afiliado!.codigo });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function fechar() {
    setNome(""); setEmail(""); setCodigo(""); setPct("20");
    setResultado(null); setCodigoTocado(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && fechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{resultado ? "Afiliado cadastrado" : "Novo afiliado"}</DialogTitle>
          {!resultado && (
            <DialogDescription>
              O e-mail precisa pertencer a um usuário já cadastrado no sistema.
            </DialogDescription>
          )}
        </DialogHeader>

        {resultado ? (
          <div className="space-y-3">
            <p className="text-sm">Compartilhe o link de indicação com o afiliado:</p>
            <div className="flex gap-2">
              <Input readOnly value={linkGerado} className="font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
              <Button
                onClick={async () => {
                  await navigator.clipboard.writeText(linkGerado);
                  toast.success("Link copiado");
                }}
              ><Copy className="h-4 w-4" /></Button>
            </div>
            <DialogFooter><Button onClick={fechar}>Fechar</Button></DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
          >
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  if (!codigoTocado) setCodigo(gerarCodigo(e.target.value));
                }}
                required maxLength={120}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">E-mail (do usuário já cadastrado)</label>
              <Input
                type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Código</label>
                <Input
                  value={codigo}
                  onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setCodigoTocado(true); }}
                  placeholder="EX: JOAO123"
                  required minLength={3} maxLength={32}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">Letras, números, _ ou -</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">% Comissão</label>
                <Input
                  type="number" min={0} max={100} step="0.01"
                  value={pct} onChange={(e) => setPct(e.target.value)} required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={fechar}>Cancelar</Button>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Criar afiliado
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetalheAfiliado({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const fetchDet = useServerFn(getAfiliadoDetalheAdmin);
  const marcar = useServerFn(marcarComissaoPaga);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-afiliado-detalhe", id],
    queryFn: () => fetchDet({ data: { afiliado_id: id } }),
  });

  const [confirmIndId, setConfirmIndId] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (indicacao_id: string) => marcar({ data: { indicacao_id } }),
    onSuccess: () => {
      toast.success("Comissão marcada como paga");
      setConfirmIndId(null);
      qc.invalidateQueries({ queryKey: ["admin-afiliado-detalhe", id] });
      qc.invalidateQueries({ queryKey: ["admin-afiliados"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar à lista
      </button>

      {isLoading ? (
        <div className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive py-6">Erro: {(error as Error).message}</p>
      ) : !data ? null : (
        <>
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-base">{data.afiliado.nome}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">E-mail</div>
                <div>{data.afiliado.email}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Código</div>
                <div className="font-mono">{data.afiliado.codigo}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">% Comissão</div>
                <div>{data.afiliado.percentual_comissao}%</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Status</div>
                <Badge className={data.afiliado.ativo ? "bg-emerald-600 hover:bg-emerald-600" : "bg-muted text-muted-foreground hover:bg-muted"}>
                  {data.afiliado.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-base">Indicações ({data.indicacoes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {data.indicacoes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhuma indicação registrada.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Indicado</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead className="text-right">Valor pago</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pago em</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.indicacoes.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>{fmtDate(i.created_at)}</TableCell>
                        <TableCell className="text-xs">{i.email_indicado}</TableCell>
                        <TableCell>{PLANO_LABEL[i.plano] ?? i.plano}</TableCell>
                        <TableCell className="text-right">{fmtMoney(i.valor_pago)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtMoney(i.valor_comissao)}</TableCell>
                        <TableCell>
                          {i.status === "pago" ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600">Pago</Badge>
                          ) : (
                            <Badge className="bg-amber-500 hover:bg-amber-500">Pendente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(i.pago_em)}</TableCell>
                        <TableCell>
                          {i.status === "pendente" && (
                            <Button size="sm" variant="secondary" onClick={() => setConfirmIndId(i.id)}>
                              Marcar como pago
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={!!confirmIndId} onOpenChange={(o) => !o && setConfirmIndId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação marca a comissão como paga e registra a data de pagamento.
              Use apenas após efetivamente pagar o afiliado — não há desfazer fácil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmIndId && mut.mutate(confirmIndId)}
              disabled={mut.isPending}
            >
              Confirmar pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
