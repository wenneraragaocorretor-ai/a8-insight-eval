import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "../../components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";
import { Loader2, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listarUsuariosAdmin } from "../../lib/admin.functions";
import {
  listarBetaTesters,
  liberarBetaTester,
  revogarBetaTester,
} from "../../lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/beta-testers")({
  component: AdminBetaTesters,
});

const planoLabel: Record<string, string> = {
  basico: "Básico",
  profissional: "Profissional",
  expert: "Expert",
};

function fmtData(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function AdminBetaTesters() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listarUsuariosAdmin);
  const fetchBetas = useServerFn(listarBetaTesters);
  const liberarFn = useServerFn(liberarBetaTester);
  const revogarFn = useServerFn(revogarBetaTester);

  const [busca, setBusca] = useState("");
  const [aplicada, setAplicada] = useState("");
  const [target, setTarget] = useState<{ id: string; nome: string | null; email: string | null } | null>(null);
  const [plano, setPlano] = useState<"basico" | "profissional" | "expert">("expert");
  const defaultExpira = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  })();
  const [expira, setExpira] = useState(defaultExpira);
  const [saving, setSaving] = useState(false);

  const usuariosQ = useQuery({
    queryKey: ["admin-usuarios", aplicada],
    queryFn: () => fetchUsers({ data: { busca: aplicada, limit: 200 } }),
  });

  const betasQ = useQuery({
    queryKey: ["admin-beta-testers"],
    queryFn: () => fetchBetas(),
  });

  const betaByUserId = new Map<string, any>();
  for (const b of betasQ.data ?? []) betaByUserId.set(b.id, b);

  const handleLiberar = async () => {
    if (!target) return;
    try {
      setSaving(true);
      await liberarFn({
        data: { user_id: target.id, plano, expira_em: new Date(expira + "T23:59:59").toISOString() },
      });
      toast.success("Acesso beta liberado");
      setTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-beta-testers"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao liberar acesso");
    } finally {
      setSaving(false);
    }
  };

  const handleRevogar = async (userId: string) => {
    if (!confirm("Revogar acesso beta deste usuário?")) return;
    try {
      await revogarFn({ data: { user_id: userId } });
      toast.success("Acesso beta revogado");
      qc.invalidateQueries({ queryKey: ["admin-beta-testers"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao revogar");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-brand-gold" />
        <h2 className="text-xl font-semibold text-brand-blue">Beta Testers</h2>
      </div>

      {/* Lista de beta testers ativos */}
      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="text-base">Beta testers ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {betasQ.isLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (betasQ.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum beta tester ativo no momento.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Plano beta</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(betasQ.data ?? []).map((b: any) => {
                  const expirado = b.beta_expira_em && new Date(b.beta_expira_em) <= new Date();
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.nome ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{b.email ?? "—"}</TableCell>
                      <TableCell>{planoLabel[b.beta_plano ?? ""] ?? "—"}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${expirado ? "bg-muted text-muted-foreground" : "bg-amber-100 text-amber-800"}`}>
                          {expirado ? `Expirado em ${fmtData(b.beta_expira_em)}` : `Beta até ${fmtData(b.beta_expira_em)}`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => handleRevogar(b.id)}>
                          <Trash2 className="h-3.5 w-3.5" /> Revogar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Buscar usuário para liberar */}
      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="text-base">Liberar acesso beta a um usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => { e.preventDefault(); setAplicada(busca.trim()); }}
            className="flex gap-2"
          >
            <Input
              placeholder="Buscar por nome ou e-mail"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Button type="submit" className="bg-brand-blue text-white">
              <Search className="h-4 w-4" /> Buscar
            </Button>
          </form>

          {usuariosQ.isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (usuariosQ.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {aplicada ? "Nenhum usuário encontrado." : "Use a busca para localizar um usuário."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Beta</TableHead>
                  <TableHead className="w-40"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usuariosQ.data ?? []).map((u: any) => {
                  const beta = betaByUserId.get(u.id);
                  const betaAtivo = beta && beta.beta_expira_em && new Date(beta.beta_expira_em) > new Date();
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
                      <TableCell>{u.plano ?? "—"}</TableCell>
                      <TableCell>
                        {betaAtivo ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Beta até {fmtData(beta.beta_expira_em)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={betaAtivo ? "outline" : "default"}
                          onClick={() => {
                            setTarget({ id: u.id, nome: u.nome, email: u.email });
                            if (beta?.beta_plano) setPlano(beta.beta_plano);
                            if (beta?.beta_expira_em) {
                              setExpira(new Date(beta.beta_expira_em).toISOString().slice(0, 10));
                            } else {
                              setExpira(defaultExpira);
                            }
                          }}
                        >
                          {betaAtivo ? "Editar beta" : "Liberar acesso beta"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => { if (!o) setTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar acesso beta</DialogTitle>
            <DialogDescription>
              {target?.nome ?? target?.email ?? "Usuário"} terá acesso completo ao plano escolhido até a data definida, sem cobrança.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Plano de teste</Label>
              <Select value={plano} onValueChange={(v) => setPlano(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="profissional">Profissional</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data de expiração</Label>
              <Input
                type="date"
                value={expira}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setExpira(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleLiberar} disabled={saving || !expira}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
