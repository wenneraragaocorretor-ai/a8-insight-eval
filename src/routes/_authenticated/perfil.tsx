import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getMeuPerfil, salvarMeuPerfil } from "../../lib/perfil.functions";
import { supabase } from "../../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ChevronLeft, Upload, User, Building2, Image as ImageIcon, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
  "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

type FormState = {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  creci: string;
  cnai: string;
  outro_registro: string;
  tipo: "pessoa_fisica" | "imobiliaria";
  nome_imobiliaria: string;
  cidade: string;
  estado: string;
  logo_url: string;
};

const empty: FormState = {
  nome: "", email: "", telefone: "", cpf: "", creci: "", cnai: "", outro_registro: "",
  tipo: "pessoa_fisica", nome_imobiliaria: "", cidade: "", estado: "", logo_url: "",
};

function formatCpf(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  let out = d;
  if (d.length > 9) out = `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  else if (d.length > 6) out = `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  else if (d.length > 3) out = `${d.slice(0,3)}.${d.slice(3)}`;
  return out;
}

function PerfilPage() {
  const fetchPerfil = useServerFn(getMeuPerfil);
  const saveFn = useServerFn(salvarMeuPerfil);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["meu-perfil"],
    queryFn: () => fetchPerfil(),
  });

  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    const p = data.profile;
    setForm({
      nome: p?.nome ?? "",
      email: p?.email ?? data.authEmail ?? "",
      telefone: p?.telefone ?? "",
      cpf: p?.cpf ?? "",
      creci: p?.creci ?? "",
      cnai: (p as any)?.cnai ?? "",
      outro_registro: (p as any)?.outro_registro ?? "",
      tipo: (p?.tipo as any) === "imobiliaria" ? "imobiliaria" : "pessoa_fisica",
      nome_imobiliaria: p?.nome_imobiliaria ?? "",
      cidade: p?.cidade ?? "",
      estado: p?.estado ?? "",
      logo_url: p?.logo_url ?? "",
    });
  }, [data]);

  // Carregar preview do logo existente (bucket privado)
  useEffect(() => {
    let revoke: string | null = null;
    (async () => {
      if (!form.logo_url) { setLogoPreview(null); return; }
      try {
        const { data: blob } = await supabase.storage.from("logos").download(form.logo_url);
        if (blob) {
          const url = URL.createObjectURL(blob);
          revoke = url;
          setLogoPreview(url);
        }
      } catch { /* ignore */ }
    })();
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [form.logo_url]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleLogoUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo deve ter no máximo 2MB");
      return;
    }
    if (!/^image\/(png|jpeg|jpg|svg\+xml)$/.test(file.type)) {
      toast.error("Use PNG, JPG ou SVG");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { toast.error("Sessão expirada"); return; }
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${uid}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });
    if (error) {
      toast.error("Falha ao enviar logo: " + error.message);
      return;
    }
    set("logo_url", path);
    toast.success("Logo carregado");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveFn({ data: form as any });
      setSavedFlash(true);
      toast.success("Perfil salvo com sucesso");
      setTimeout(() => setSavedFlash(false), 3000);
      await refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const isImobiliaria = form.tipo === "imobiliaria";

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div>
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ChevronLeft size={16} /> Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-brand-blue mt-2">Meu Perfil</h1>
        <p className="text-muted-foreground">Estes dados aparecem nos seus laudos.</p>
      </div>

      {isLoading ? (
        <Card className="premium-card"><CardContent className="py-10 text-center text-muted-foreground">Carregando...</CardContent></Card>
      ) : (
      <form onSubmit={submit} className="space-y-6">
        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User size={18} /> Informações Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Nome completo *</Label>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} required />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <Label>Telefone / WhatsApp *</Label>
              <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} required placeholder="(11) 99999-0000" />
            </div>
            <div>
              <Label>CPF *</Label>
              <Input
                value={form.cpf}
                onChange={(e) => set("cpf", formatCpf(e.target.value))}
                required
                inputMode="numeric"
                maxLength={14}
                placeholder="000.000.000-00"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 size={18} /> Informações Profissionais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>CRECI / CAU / CREA</Label>
              <Input value={form.creci} onChange={(e) => set("creci", e.target.value)} placeholder="Ex: CRECI-SP 123456, CAU A12345-0, CREA-SP 123456" />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => set("tipo", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pessoa_fisica">Corretor Pessoa Física</SelectItem>
                  <SelectItem value="imobiliaria">Imobiliária</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isImobiliaria && (
              <div className="md:col-span-2">
                <Label>Nome da Imobiliária</Label>
                <Input value={form.nome_imobiliaria} onChange={(e) => set("nome_imobiliaria", e.target.value)} />
              </div>
            )}
            <div>
              <Label>Cidade *</Label>
              <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} required />
            </div>
            <div>
              <Label>Estado *</Label>
              <Select value={form.estado} onValueChange={(v) => set("estado", v)}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ImageIcon size={18} /> Marca e Identidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row items-start gap-4">
              <div className="w-40 h-40 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">Sem logo</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleLogoUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                  <Upload size={14} /> Carregar logo
                </Button>
                <p className="text-xs text-muted-foreground">PNG, JPG ou SVG. Máx 2MB.</p>
                {form.logo_url && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set("logo_url", "")}>
                    Remover logo
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} className="bg-brand-gold text-primary-foreground h-11 px-6">
            {saving ? "Salvando..." : "Salvar Perfil"}
          </Button>
          {savedFlash && (
            <span className="inline-flex items-center gap-1 text-sm text-green-600 font-medium">
              <CheckCircle2 size={16} /> Salvo com sucesso
            </span>
          )}
        </div>
      </form>
      )}
    </div>
  );
}
