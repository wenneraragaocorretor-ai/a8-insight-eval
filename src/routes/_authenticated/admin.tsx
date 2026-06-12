import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ArrowLeft, Search, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  amIAdmin,
  buscarUsuarioPorEmail,
  redefinirPlanoUsuario,
} from "../../lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type FoundResult = Awaited<ReturnType<typeof buscarUsuarioPorEmail>>;

function AdminPage() {
  const fetchAdmin = useServerFn(amIAdmin);
  const buscar = useServerFn(buscarUsuarioPorEmail);
  const redefinir = useServerFn(redefinirPlanoUsuario);

  const { data: adminStatus, isLoading: loadingAdmin } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => fetchAdmin(),
  });

  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<FoundResult | null>(null);
  const [plano, setPlano] = useState<"basico" | "profissional" | "expert">("basico");
  const [creditos, setCreditos] = useState<string>("");
  const [saving, setSaving] = useState(false);

  if (loadingAdmin) {
    return (
      <div className="max-w-3xl mx-auto py-16 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!adminStatus?.admin) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-brand-blue">Acesso restrito</h1>
        <p className="text-muted-foreground">
          Esta página é exclusiva para administradores.
        </p>
        <Link to="/dashboard">
          <Button variant="outline">Voltar ao dashboard</Button>
        </Link>
      </div>
    );
  }

  async function onBuscar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSearching(true);
    setResult(null);
    try {
      const r = await buscar({ data: { email: email.trim() } });
      setResult(r);
      if (!r.found) {
        toast.error("Usuário não encontrado.");
      } else if (r.profile) {
        setPlano((r.profile.plano as any) ?? "basico");
        setCreditos(String(r.profile.creditos_avulsos ?? 0));
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao buscar usuário.");
    } finally {
      setSearching(false);
    }
  }

  async function onRedefinir() {
    if (!result?.found || !result.user) return;
    setSaving(true);
    try {
      await redefinir({
        data: {
          user_id: result.user.id,
          plano,
          creditos_avulsos: creditos === "" ? undefined : Number(creditos),
          limparAssinatura: true,
        },
      });
      toast.success(`Plano redefinido para "${plano}".`);
      // Recarrega o perfil
      const r = await buscar({ data: { email: email.trim() } });
      setResult(r);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao redefinir plano.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Voltar ao dashboard
      </Link>

      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-brand-gold" />
        <div>
          <h1 className="text-2xl font-bold text-brand-blue">Painel administrativo</h1>
          <p className="text-sm text-muted-foreground">
            Redefinir manualmente o plano de um usuário por e-mail.
          </p>
        </div>
      </div>

      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="text-lg">Buscar usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onBuscar} className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="email">E-mail do usuário</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex md:items-end">
              <Button
                type="submit"
                disabled={searching || !email.trim()}
                className="h-10 gap-2"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result?.found && result.user && (
        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="text-lg">{result.user.email}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Plano atual</p>
                <p className="font-semibold">{result.profile?.plano ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status assinatura</p>
                <p className="font-semibold">{result.profile?.subscription_status ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Créditos avulsos</p>
                <p className="font-semibold">{result.profile?.creditos_avulsos ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Subscription ID</p>
                <p className="font-mono text-xs break-all">
                  {result.profile?.stripe_subscription_id ?? "—"}
                </p>
              </div>
            </div>

            <hr />

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Novo plano</Label>
                <div className="flex gap-2 flex-wrap">
                  {(["basico", "profissional", "expert"] as const).map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant={plano === p ? "default" : "outline"}
                      onClick={() => setPlano(p)}
                      className={plano === p ? "bg-[#0A1F44] text-white" : ""}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="creditos">Créditos avulsos (opcional)</Label>
                <Input
                  id="creditos"
                  type="number"
                  min={0}
                  max={999}
                  value={creditos}
                  onChange={(e) => setCreditos(e.target.value)}
                  className="max-w-[160px]"
                />
                <p className="text-xs text-muted-foreground">
                  Deixe vazio para manter o valor atual.
                </p>
              </div>

              <div className="text-xs text-muted-foreground bg-yellow-50 border border-yellow-200 rounded p-3">
                Ao redefinir, a assinatura local será desvinculada (subscription_status,
                stripe_subscription_id e plan_price_id ficam nulos). Não cancela a
                assinatura no Stripe — faça isso manualmente no painel do Stripe se
                necessário.
              </div>

              <Button
                onClick={onRedefinir}
                disabled={saving}
                className="bg-brand-gold text-primary-foreground gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Redefinir plano
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
