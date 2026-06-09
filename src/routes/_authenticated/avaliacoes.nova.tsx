import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { processarAvaliacaoIA } from "../../lib/avaliacoes.functions";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Sparkles, Plus, Trash2 } from "lucide-react";

const CARACTERISTICAS_OPCOES = [
  "Piscina",
  "Churrasqueira",
  "Elevador",
  "Condomínio Fechado",
  "Área de Lazer",
  "Energia Solar",
  "Gerador",
];

const CARACTERISTICAS_COMPARAVEL = [
  "Piscina",
  "Churrasqueira",
  "Elevador",
  "Condomínio Fechado",
  "Área de Lazer",
];

const POSICOES_IMOVEL = ["Meio de quadra", "Esquina", "Encravado", "Gleba"];
const POSICOES_COMPARAVEL = ["Meio de quadra", "Esquina", "Encravado"];
const PADROES = ["Simples", "Normal", "Alto", "Luxo"];
const CONSERVACOES = ["Novo", "Bom", "Regular", "Ruim"];

const TIPOS_IMOVEL = ["Apartamento", "Casa", "Terreno", "Sala Comercial", "Galpão"] as const;
type TipoImovel = typeof TIPOS_IMOVEL[number];

type NativeSelectProps = {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
};

function NativeSelect({ value, options, onChange }: NativeSelectProps) {
  return (
    <select
      value={value}
      onChange={(event) => safe(() => onChange(event.currentTarget.value))}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

// Regras de campos condicionais por tipo de imóvel
const camposDoTipo = (tipo: string) => {
  const base = {
    quartos: true,
    suites: true,
    banheiros: true,
    vagas: true,
    andar: false,
    areaPrivativa: true,
    conservacao: true,
    caracteristicas: true,
  };
  switch (tipo) {
    case "Apartamento":
      return { ...base, andar: true };
    case "Casa":
      return { ...base, andar: false };
    case "Terreno":
      return {
        ...base,
        quartos: false,
        suites: false,
        banheiros: false,
        vagas: false,
        andar: false,
        areaPrivativa: false,
        conservacao: false,
        caracteristicas: false,
      };
    case "Sala Comercial":
      return { ...base, quartos: false, suites: false, andar: true };
    case "Galpão":
      return {
        ...base,
        quartos: false,
        suites: false,
        banheiros: true,
        andar: false,
        areaPrivativa: false,
      };
    default:
      return base;
  }
};

type Comparavel = {
  id: number;
  fonte: string;
  localizacao: string;
  area: number;
  area_privativa: number;
  quartos: number;
  suites: number;
  banheiros: number;
  vagas: number;
  padrao: string;
  conservacao: string;
  posicao: string;
  andar: number;
  idade: number;
  condominio: number;
  caracteristicas: string[];
  valor: number;
};

const novoComparavel = (id: number): Comparavel => ({
  id,
  fonte: "",
  localizacao: "",
  area: 0,
  area_privativa: 0,
  quartos: 0,
  suites: 0,
  banheiros: 0,
  vagas: 0,
  padrao: "Normal",
  conservacao: "Bom",
  posicao: "Meio de quadra",
  andar: 0,
  idade: 0,
  condominio: 0,
  caracteristicas: [],
  valor: 0,
});

export const Route = createFileRoute("/_authenticated/avaliacoes/nova")({
  component: () => (
    <ErrorBoundary fallbackTitle="Erro no formulário de Nova Avaliação">
      <NovaAvaliacao />
    </ErrorBoundary>
  ),
});

const safe = <T,>(fn: () => T, fallback?: T): T | undefined => {
  try {
    return fn();
  } catch (err) {
    console.error("Handler error:", err);
    toast.error("Não foi possível atualizar este campo.");
    return fallback;
  }
};

const toNum = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function NovaAvaliacao() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const processarIA = useServerFn(processarAvaliacaoIA);

  const [imovel, setImovel] = useState({
    tipo: "Apartamento" as string,
    finalidade: "Venda",
    localizacao: "",
    area_total: 0,
    area_privativa: 0,
    quartos: 0,
    suites: 0,
    banheiros: 0,
    vagas: 0,
    andar: 0,
    padrao: "Normal",
    conservacao: "Bom",
    posicao: "Meio de quadra",
    caracteristicas: [] as string[],
    observacoes: "",
  });

  const [comparaveis, setComparaveis] = useState<Comparavel[]>([
    novoComparavel(1),
    novoComparavel(2),
    novoComparavel(3),
  ]);

  const campos = camposDoTipo(imovel.tipo);

  const setImovelField = <K extends keyof typeof imovel>(key: K, value: (typeof imovel)[K]) => {
    safe(() => setImovel((prev) => ({ ...prev, [key]: value })));
  };

  const onTipoChange = (v: string) => {
    safe(() => {
      const novoCampos = camposDoTipo(v);
      setImovel((prev) => ({
        ...prev,
        tipo: v,
        quartos: novoCampos.quartos ? prev.quartos : 0,
        suites: novoCampos.suites ? prev.suites : 0,
        banheiros: novoCampos.banheiros ? prev.banheiros : 0,
        vagas: novoCampos.vagas ? prev.vagas : 0,
        andar: novoCampos.andar ? prev.andar : 0,
        area_privativa: novoCampos.areaPrivativa ? prev.area_privativa : 0,
        conservacao: novoCampos.conservacao ? prev.conservacao : "Bom",
        caracteristicas: novoCampos.caracteristicas ? prev.caracteristicas : [],
      }));
    });
  };

  const addComparavel = () => {
    safe(() => {
      if (comparaveis.length < 12) {
        setComparaveis((prev) => [...prev, novoComparavel(Date.now())]);
      }
    });
  };

  const removeComparavel = (id: number) => {
    safe(() => {
      if (comparaveis.length > 3) {
        setComparaveis((prev) => prev.filter((c) => c.id !== id));
      }
    });
  };

  const updateComp = (index: number, patch: Partial<Comparavel>) => {
    safe(() => {
      setComparaveis((prev) => {
        const next = [...prev];
        if (!next[index]) return prev;
        next[index] = { ...next[index], ...patch };
        return next;
      });
    });
  };

  const toggleCaracteristica = (opcao: string) => {
    safe(() => {
      setImovel((prev) => ({
        ...prev,
        caracteristicas: prev.caracteristicas.includes(opcao)
          ? prev.caracteristicas.filter((c) => c !== opcao)
          : [...prev.caracteristicas, opcao],
      }));
    });
  };

  const toggleCompCaracteristica = (index: number, opcao: string) => {
    safe(() => {
      const cur = comparaveis[index]?.caracteristicas ?? [];
      updateComp(index, {
        caracteristicas: cur.includes(opcao) ? cur.filter((c) => c !== opcao) : [...cur, opcao],
      });
    });
  };

  const handleProcessar = async () => {
    setIsLoading(true);
    try {
      const c = camposDoTipo(imovel.tipo);
      const payload = {
        data: {
          imovel: {
            ...imovel,
            area_privativa: c.areaPrivativa ? imovel.area_privativa || undefined : undefined,
            quartos: c.quartos ? imovel.quartos : 0,
            suites: c.suites ? imovel.suites || undefined : undefined,
            banheiros: c.banheiros ? imovel.banheiros : 0,
            vagas: c.vagas ? imovel.vagas : 0,
            andar: c.andar ? imovel.andar || undefined : undefined,
            conservacao: c.conservacao ? imovel.conservacao : "Bom",
            caracteristicas: c.caracteristicas ? imovel.caracteristicas : [],
          },
          comparaveis: comparaveis.map(({ id, ...c2 }) => ({
            fonte: c2.fonte,
            localizacao: c2.localizacao,
            area: c2.area,
            area_privativa: c.areaPrivativa ? c2.area_privativa || undefined : undefined,
            quartos: c.quartos ? c2.quartos || undefined : undefined,
            suites: c.suites ? c2.suites || undefined : undefined,
            banheiros: c.banheiros ? c2.banheiros || undefined : undefined,
            vagas: c.vagas ? c2.vagas || undefined : undefined,
            padrao: c2.padrao,
            conservacao: c.conservacao ? c2.conservacao : undefined,
            posicao: c2.posicao,
            andar: c.andar ? c2.andar || undefined : undefined,
            idade: c2.idade || undefined,
            condominio: c2.condominio || undefined,
            caracteristicas: c.caracteristicas ? c2.caracteristicas : [],
            valor: c2.valor,
          })),
        },
      };

      const result = await processarIA(payload);
      toast.success("Avaliação concluída com sucesso!");
      if (result && result.id) navigate({ to: `/avaliacoes/${result.id}` });
      else navigate({ to: "/dashboard" });
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message || "Erro ao processar avaliação.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-blue">Nova Avaliação</h1>
          <p className="text-muted-foreground">Preencha os dados para gerar o estudo com IA.</p>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`w-10 h-2 rounded-full ${step >= s ? "bg-brand-gold" : "bg-muted"}`} />
          ))}
        </div>
      </div>

      {step === 1 && (
        <Card className="premium-card">
          <CardHeader><CardTitle>Dados do Imóvel</CardTitle></CardHeader>
          <CardContent key={imovel.tipo} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Tipo do Imóvel</Label>
              <Select value={imovel.tipo} onValueChange={onTipoChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_IMOVEL.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Localização (Bairro/Cidade)</Label>
              <Input
                placeholder="Ex: Itaim Bibi, São Paulo"
                value={imovel.localizacao}
                onChange={(e) => setImovelField("localizacao", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Área Total (m²)</Label>
              <Input
                type="number"
                value={imovel.area_total}
                onChange={(e) => setImovelField("area_total", toNum(e.target.value))}
              />
            </div>
            {campos.areaPrivativa && (
              <div className="space-y-2">
                <Label>Área Privativa (m²)</Label>
                <Input
                  type="number"
                  value={imovel.area_privativa || ""}
                  placeholder="Opcional"
                  onChange={(e) => setImovelField("area_privativa", toNum(e.target.value))}
                />
              </div>
            )}

            {(campos.quartos || campos.suites || campos.banheiros || campos.vagas) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:col-span-2">
                {campos.quartos && (
                  <div className="space-y-2">
                    <Label>Quartos</Label>
                    <Input type="number" value={imovel.quartos}
                      onChange={(e) => setImovelField("quartos", toNum(e.target.value))} />
                  </div>
                )}
                {campos.suites && (
                  <div className="space-y-2">
                    <Label>Suítes</Label>
                    <Input type="number" value={imovel.suites}
                      onChange={(e) => setImovelField("suites", toNum(e.target.value))} />
                  </div>
                )}
                {campos.banheiros && (
                  <div className="space-y-2">
                    <Label>Banheiros</Label>
                    <Input type="number" value={imovel.banheiros}
                      onChange={(e) => setImovelField("banheiros", toNum(e.target.value))} />
                  </div>
                )}
                {campos.vagas && (
                  <div className="space-y-2">
                    <Label>Vagas</Label>
                    <Input type="number" value={imovel.vagas}
                      onChange={(e) => setImovelField("vagas", toNum(e.target.value))} />
                  </div>
                )}
              </div>
            )}

            {campos.andar && (
              <div className="space-y-2">
                <Label>Andar {imovel.tipo === "Apartamento" ? "*" : ""}</Label>
                <Input
                  type="number"
                  value={imovel.andar || ""}
                  placeholder={imovel.tipo === "Apartamento" ? "Obrigatório" : "Opcional"}
                  onChange={(e) => setImovelField("andar", toNum(e.target.value))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Posição do terreno/imóvel</Label>
              <Select value={imovel.posicao} onValueChange={(v) => setImovelField("posicao", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POSICOES_IMOVEL.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Padrão Construtivo</Label>
              <Select value={imovel.padrao} onValueChange={(v) => setImovelField("padrao", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PADROES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {campos.conservacao && (
              <div className="space-y-2">
                <Label>Estado de Conservação</Label>
                <Select value={imovel.conservacao} onValueChange={(v) => setImovelField("conservacao", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONSERVACOES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {campos.caracteristicas && (
              <div className="space-y-3 md:col-span-2">
                <Label>Características Adicionais</Label>
                <div className="flex flex-wrap gap-4">
                  {CARACTERISTICAS_OPCOES.map((opcao) => (
                    <label key={opcao} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={imovel.caracteristicas.includes(opcao)}
                        onCheckedChange={() => toggleCaracteristica(opcao)}
                      />
                      <span className="text-sm">{opcao}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label>Observações</Label>
              <Input
                placeholder="Informações complementares..."
                value={imovel.observacoes}
                onChange={(e) => setImovelField("observacoes", e.target.value)}
              />
            </div>
          </CardContent>
          <div className="p-6 border-t flex justify-end">
            <Button onClick={() => setStep(2)} className="bg-brand-blue gap-2">
              Próximo <ChevronRight size={18} />
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-brand-blue">Imóveis Comparáveis (Mínimo 3)</h2>
          {comparaveis.map((c, index) => (
            <Card key={c.id} className="premium-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Comparável #{index + 1}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeComparavel(c.id)}
                  className="text-destructive"
                  disabled={comparaveis.length <= 3}
                >
                  <Trash2 size={18} />
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Fonte (Ex: Zap, OLX)</Label>
                  <Input value={c.fonte} onChange={(e) => updateComp(index, { fonte: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Localização / Referência</Label>
                  <Input value={c.localizacao} onChange={(e) => updateComp(index, { localizacao: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Área Total (m²)</Label>
                  <Input type="number" value={c.area}
                    onChange={(e) => updateComp(index, { area: toNum(e.target.value) })} />
                </div>
                {campos.areaPrivativa && (
                  <div className="space-y-2">
                    <Label>Área Privativa (m²)</Label>
                    <Input type="number" value={c.area_privativa || ""} placeholder="Opcional"
                      onChange={(e) => updateComp(index, { area_privativa: toNum(e.target.value) })} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Valor Anunciado (R$)</Label>
                  <Input type="number" value={c.valor}
                    onChange={(e) => updateComp(index, { valor: toNum(e.target.value) })} />
                </div>
                {campos.quartos && (
                  <div className="space-y-2">
                    <Label>Quartos</Label>
                    <Input type="number" value={c.quartos}
                      onChange={(e) => updateComp(index, { quartos: toNum(e.target.value) })} />
                  </div>
                )}
                {campos.suites && (
                  <div className="space-y-2">
                    <Label>Suítes</Label>
                    <Input type="number" value={c.suites}
                      onChange={(e) => updateComp(index, { suites: toNum(e.target.value) })} />
                  </div>
                )}
                {campos.banheiros && (
                  <div className="space-y-2">
                    <Label>Banheiros</Label>
                    <Input type="number" value={c.banheiros}
                      onChange={(e) => updateComp(index, { banheiros: toNum(e.target.value) })} />
                  </div>
                )}
                {campos.vagas && (
                  <div className="space-y-2">
                    <Label>Vagas</Label>
                    <Input type="number" value={c.vagas}
                      onChange={(e) => updateComp(index, { vagas: toNum(e.target.value) })} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Padrão Construtivo</Label>
                  <Select value={c.padrao} onValueChange={(v) => updateComp(index, { padrao: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PADROES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {campos.conservacao && (
                  <div className="space-y-2">
                    <Label>Estado de Conservação</Label>
                    <Select value={c.conservacao} onValueChange={(v) => updateComp(index, { conservacao: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONSERVACOES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Posição</Label>
                  <Select value={c.posicao} onValueChange={(v) => updateComp(index, { posicao: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {POSICOES_COMPARAVEL.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {campos.andar && (
                  <div className="space-y-2">
                    <Label>Andar</Label>
                    <Input type="number" value={c.andar || ""} placeholder="Opcional"
                      onChange={(e) => updateComp(index, { andar: toNum(e.target.value) })} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Idade aprox. (anos)</Label>
                  <Input type="number" value={c.idade || ""} placeholder="Opcional"
                    onChange={(e) => updateComp(index, { idade: toNum(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Condomínio mensal (R$)</Label>
                  <Input type="number" value={c.condominio || ""} placeholder="Opcional"
                    onChange={(e) => updateComp(index, { condominio: toNum(e.target.value) })} />
                </div>
                {campos.caracteristicas && (
                  <div className="space-y-3 md:col-span-3">
                    <Label>Características presentes</Label>
                    <div className="flex flex-wrap gap-4">
                      {CARACTERISTICAS_COMPARAVEL.map((opcao) => (
                        <label key={opcao} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={c.caracteristicas.includes(opcao)}
                            onCheckedChange={() => toggleCompCaracteristica(index, opcao)}
                          />
                          <span className="text-sm">{opcao}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={() => addComparavel()} className="gap-2">
              <Plus size={18} /> Adicionar outro
            </Button>
            <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
                <ChevronLeft size={18} /> Voltar
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="bg-brand-blue"
                disabled={comparaveis.some((c) => !c.fonte || !c.area || !c.valor)}
              >
                Próximo
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <Card className="premium-card text-center py-12">
          <CardContent className="space-y-6">
            <div className="bg-brand-gold/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="text-brand-gold h-10 w-10 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-brand-blue">Tudo pronto!</h2>
              <p className="text-muted-foreground">Nossa IA irá analisar os dados e gerar seu relatório.</p>
            </div>
            <div className="flex flex-col gap-4 max-w-sm mx-auto">
              <Button onClick={handleProcessar} className="bg-brand-gold text-primary-foreground h-12 text-lg font-bold" disabled={isLoading}>
                {isLoading ? "Processando..." : "Gerar Avaliação com IA"}
              </Button>
              <Button variant="ghost" onClick={() => setStep(2)} disabled={isLoading}>Revisar dados</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="mt-8 text-xs text-center text-muted-foreground italic">
        "Esta avaliação é mercadológica e não substitui laudo técnico assinado por profissional habilitado (CNAI/IBAPE)"
      </p>
    </div>
  );
}
