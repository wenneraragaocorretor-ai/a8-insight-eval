import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { processarAvaliacaoIA, regerarAvaliacao, getAvaliacaoDetalhe, limiteEdicoesPorPlano } from "../../lib/avaliacoes.functions";
import { supabase } from "../../integrations/supabase/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Sparkles, Plus, Trash2, Upload, X, ImagePlus, ClipboardList, Star, Pencil } from "lucide-react";


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

const IDADE_APARENTE_OPCOES = [
  "Aparenta menos que a idade real",
  "Condizente com a idade real",
  "Aparenta mais que a idade real",
];
const POSICAO_SOLAR_OPCOES = ["Nascente", "Poente", "Norte", "Sul", "Não identificado"];
const TOPOGRAFIA_OPCOES = ["Plano", "Aclive", "Declive", "Irregular"];
const INFRA_LAZER_OPCOES = [
  "Piscina",
  "Academia",
  "Salão de Festas",
  "Churrasqueira",
  "Playground",
  "Quadra",
  "Portaria 24h",
  "Elevador",
  "Sauna",
  "Cinema",
  "Quadra de Beach Tennis",
  "Quadra de Tênis",
  "Espaço Gourmet",
  "Coworking",
  "Pet Place",
  "Brinquedoteca",
  "Nenhum",
];

const TIPO_ACABAMENTO_OPCOES = [
  "Mármore",
  "Porcelanato",
  "Cerâmica",
  "Granito",
  "Madeira",
  "Laminado",
  "Cimento Queimado",
  "Pastilha",
  "Tinta Simples",
  "Alto Padrão Importado",
];
const NUMERO_PAVIMENTOS_OPCOES = ["1 pavimento", "2 pavimentos", "3 ou mais pavimentos"];

const AMBIENTES_SOCIAIS_OPCOES = [
  "Sala de Estar",
  "Sala de Jantar",
  "Sala de TV",
  "Varanda",
  "Terraço",
  "Sacada",
];
const AMBIENTES_SERVICO_OPCOES = [
  "Cozinha Simples",
  "Cozinha Gourmet",
  "Copa",
  "Lavanderia",
  "Área de Serviço",
  "Quarto de Empregada",
  "Banheiro de Serviço",
  "Despensa",
];
const AMBIENTES_OUTROS_OPCOES = [
  "Escritório / Home Office",
  "Closet",
  "Adega",
  "Hall de Entrada",
];

const TIPOS_IMOVEL = ["Apartamento", "Casa", "Sobrado", "Terreno", "Sala Comercial", "Galpão"] as const;
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
    case "Sobrado":
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
  validateSearch: (s: Record<string, unknown>): { edit?: string } => ({
    edit: typeof s.edit === "string" ? s.edit : undefined,
  }),
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

const extrairDominio = (url: string): string => {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const calcularValorM2 = (valor: number, area: number): number | null => {
  if (!area || area <= 0 || !valor || valor <= 0) return null;
  return valor / area;
};

function NovaAvaliacao() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const search = Route.useSearch();
  const editId = search.edit;
  const isEdit = !!editId;
  const processarIA = useServerFn(processarAvaliacaoIA);
  const regerarIA = useServerFn(regerarAvaliacao);
  const fetchDetalhe = useServerFn(getAvaliacaoDetalhe);
  const [edicoesUsadas, setEdicoesUsadas] = useState(0);

  const [imovel, setImovel] = useState({
    tipo: "Apartamento" as string,
    finalidade: "Venda",
    localizacao: "",
    endereco_completo: "",
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
    // Ficha Técnica Detalhada (Expert)
    idade_real: 0,
    idade_aparente: "",
    posicao_solar: "",
    topografia: "",
    zoneamento: "",
    infraestrutura_lazer: [] as string[],
    lazer_outros: "",
    vagas_cobertas: 0,
    vagas_descobertas: 0,
    total_andares: 0,
    tipo_acabamento: [] as string[],
    acabamento_outros: "",
    numero_pavimentos: "",
    ambientes_sociais: [] as string[],
    ambientes_sociais_outros: "",
    ambientes_servico: [] as string[],
    ambientes_servico_outros: "",
    ambientes_outros: [] as string[],
    ambientes_outros_livres: "",
  });

  const [plano, setPlano] = useState<string>("basico");
  const isExpert = plano === "expert";

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) return;
      const { data } = await supabase.from("profiles").select("plano").eq("id", uid).maybeSingle();
      if (data?.plano) setPlano(data.plano);
    })();
  }, []);

  const [comparaveis, setComparaveis] = useState<Comparavel[]>([
    novoComparavel(1),
    novoComparavel(2),
    novoComparavel(3),
  ]);

  type FotoItem = {
    path: string;
    previewUrl: string;
    uploading?: boolean;
    legenda: string;
    principal: boolean;
  };
  const [fotos, setFotos] = useState<FotoItem[]>([]);

  const maxFotos = plano === "expert" ? 15 : plano === "profissional" || plano === "pro" ? 5 : 3;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Limpa as object URLs ao desmontar
  useEffect(() => {
    return () => {
      fotos.forEach((f) => {
        if (f.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(f.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ACEITOS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const MAX_BYTES = 5 * 1024 * 1024;

  const handleFotosSelected = async (filesList: FileList | null) => {
    if (!filesList) return;
    const files = Array.from(filesList);
    const disponivel = maxFotos - fotos.length;
    if (disponivel <= 0) {
      toast.error(`Limite de ${maxFotos} fotos atingido.`);
      return;
    }
    const aProcessar = files.slice(0, disponivel);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    for (const file of aProcessar) {
      if (!ACEITOS.includes(file.type)) {
        toast.error(`${file.name}: formato inválido (use JPG, PNG ou WEBP).`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: maior que 5MB.`);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      const tempItem: FotoItem = { path: "", previewUrl, uploading: true, legenda: "", principal: false };
      setFotos((prev) => [...prev, tempItem]);
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from("avaliacoes-fotos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        setFotos((prev) =>
          prev.map((f) => (f.previewUrl === previewUrl ? { ...f, path, uploading: false } : f)),
        );
      } catch (err: any) {
        console.error("Erro no upload:", err);
        toast.error(`Falha ao enviar ${file.name}: ${err.message || "erro desconhecido"}`);
        setFotos((prev) => prev.filter((f) => f.previewUrl !== previewUrl));
        URL.revokeObjectURL(previewUrl);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removerFoto = async (idx: number) => {
    const alvo = fotos[idx];
    if (!alvo) return;
    setFotos((prev) => prev.filter((_, i) => i !== idx));
    if (alvo.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(alvo.previewUrl);
    if (alvo.path) {
      try {
        await supabase.storage.from("avaliacoes-fotos").remove([alvo.path]);
      } catch (e) {
        console.error("Falha ao remover do storage:", e);
      }
    }
  };

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
            fotos: fotos.filter((f) => f.path && !f.uploading).map((f) => f.path),
            fotos_meta: (() => {
              const validas = fotos.filter((f) => f.path && !f.uploading);
              const temPrincipal = validas.some((f) => f.principal);
              return validas.map((f, i) => ({
                path: f.path,
                legenda: f.legenda || "",
                principal: temPrincipal ? f.principal : i === 0,
              }));
            })(),
            // Ficha Técnica Detalhada — só envia se Expert
            idade_real: isExpert ? imovel.idade_real || undefined : undefined,
            idade_aparente: isExpert ? imovel.idade_aparente || undefined : undefined,
            posicao_solar: isExpert ? imovel.posicao_solar || undefined : undefined,
            topografia: isExpert ? imovel.topografia || undefined : undefined,
            zoneamento: isExpert ? imovel.zoneamento || undefined : undefined,
            infraestrutura_lazer: isExpert
              ? [
                  ...imovel.infraestrutura_lazer,
                  ...imovel.lazer_outros
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0),
                ]
              : [],
            vagas_cobertas: isExpert ? imovel.vagas_cobertas || undefined : undefined,
            vagas_descobertas: isExpert ? imovel.vagas_descobertas || undefined : undefined,
            total_andares: isExpert ? imovel.total_andares || undefined : undefined,
            tipo_acabamento: isExpert
              ? [
                  ...imovel.tipo_acabamento,
                  ...imovel.acabamento_outros
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0),
                ]
              : [],
            numero_pavimentos:
              isExpert && (imovel.tipo === "Casa" || imovel.tipo === "Sobrado")
                ? imovel.numero_pavimentos || undefined
                : undefined,
            ambientes_sociais: [
              ...imovel.ambientes_sociais,
              ...imovel.ambientes_sociais_outros
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0),
            ],
            ambientes_servico: [
              ...imovel.ambientes_servico,
              ...imovel.ambientes_servico_outros
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0),
            ],
            ambientes_outros: [
              ...imovel.ambientes_outros,
              ...imovel.ambientes_outros_livres
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0),
            ],
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
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Tipo do Imóvel</Label>
              <NativeSelect value={imovel.tipo} options={TIPOS_IMOVEL} onChange={onTipoChange} />
            </div>
            <div className="space-y-2">
              <Label>Localização (Bairro/Cidade)</Label>
              <Input
                placeholder="Ex: Itaim Bibi, São Paulo"
                value={imovel.localizacao}
                onChange={(e) => setImovelField("localizacao", e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Endereço completo do imóvel</Label>
              <Input
                placeholder="Ex: Rua Joaquim Floriano, 100, Itaim Bibi, São Paulo - SP, 04534-000"
                value={imovel.endereco_completo}
                onChange={(e) => setImovelField("endereco_completo", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Usado para gerar a página de Localização no laudo Expert. Quanto mais completo, melhor.
              </p>
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
              <NativeSelect value={imovel.posicao} options={POSICOES_IMOVEL} onChange={(v) => setImovelField("posicao", v)} />
            </div>

            <div className="space-y-2">
              <Label>Padrão Construtivo</Label>
              <NativeSelect value={imovel.padrao} options={PADROES} onChange={(v) => setImovelField("padrao", v)} />
            </div>

            {campos.conservacao && (
              <div className="space-y-2">
                <Label>Estado de Conservação</Label>
                <NativeSelect value={imovel.conservacao} options={CONSERVACOES} onChange={(v) => setImovelField("conservacao", v)} />
              </div>
            )}

            {campos.caracteristicas && (
              <div className="space-y-3 md:col-span-2">
                <Label>Características Adicionais</Label>
                <div className="flex flex-wrap gap-4">
                  {CARACTERISTICAS_OPCOES.map((opcao) => (
                    <label key={opcao} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={imovel.caracteristicas.includes(opcao)}
                        onChange={() => toggleCaracteristica(opcao)}
                        className="h-4 w-4 shrink-0 cursor-pointer rounded-sm accent-brand-blue"
                      />
                      <span className="text-sm">{opcao}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {camposDoTipo(imovel.tipo).caracteristicas && (
              <div className="md:col-span-2 rounded-lg border border-border bg-muted/30 p-5 space-y-5">
                <h3 className="text-lg font-semibold text-brand-blue">Ambientes do Imóvel</h3>

                {[
                  {
                    titulo: "Ambientes Sociais",
                    opcoes: AMBIENTES_SOCIAIS_OPCOES,
                    key: "ambientes_sociais" as const,
                    outrosKey: "ambientes_sociais_outros" as const,
                  },
                  {
                    titulo: "Ambientes de Serviço",
                    opcoes: AMBIENTES_SERVICO_OPCOES,
                    key: "ambientes_servico" as const,
                    outrosKey: "ambientes_servico_outros" as const,
                  },
                  {
                    titulo: "Outros Ambientes",
                    opcoes: AMBIENTES_OUTROS_OPCOES,
                    key: "ambientes_outros" as const,
                    outrosKey: "ambientes_outros_livres" as const,
                  },
                ].map((grupo) => (
                  <div key={grupo.titulo} className="space-y-3">
                    <Label className="text-sm font-semibold uppercase tracking-wide text-brand-blue">
                      {grupo.titulo}
                    </Label>
                    <div className="flex flex-wrap gap-4">
                      {grupo.opcoes.map((opcao) => (
                        <label key={opcao} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(imovel[grupo.key] as string[]).includes(opcao)}
                            onChange={() =>
                              safe(() =>
                                setImovel((prev) => {
                                  const atual = prev[grupo.key] as string[];
                                  return {
                                    ...prev,
                                    [grupo.key]: atual.includes(opcao)
                                      ? atual.filter((c) => c !== opcao)
                                      : [...atual, opcao],
                                  };
                                }),
                              )
                            }
                            className="h-4 w-4 shrink-0 cursor-pointer rounded-sm accent-brand-blue"
                          />
                          <span className="text-sm">{opcao}</span>
                        </label>
                      ))}
                    </div>
                    <Input
                      placeholder="Ex: Brinquedoteca, Sala de jogos..."
                      value={imovel[grupo.outrosKey] as string}
                      onChange={(e) => setImovelField(grupo.outrosKey, e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Outros ambientes (separe por vírgula)
                    </p>
                  </div>
                ))}
              </div>
            )}

            {isExpert && (
              <div className="md:col-span-2 rounded-lg border border-brand-gold/40 bg-brand-gold/5 p-5 space-y-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="bg-brand-gold/15 text-brand-gold rounded-md p-2">
                    <ClipboardList size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-brand-blue">Ficha Técnica Detalhada</h3>
                  <span className="text-xs font-bold uppercase tracking-wide bg-brand-gold text-white px-2 py-0.5 rounded">
                    Expert
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Campos avançados exclusivos do Plano Expert — refinam a análise técnica do imóvel.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Idade Real do Imóvel (anos)</Label>
                    <Input
                      type="number"
                      placeholder="Opcional"
                      value={imovel.idade_real || ""}
                      onChange={(e) => setImovelField("idade_real", toNum(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Idade Aparente</Label>
                    <NativeSelect
                      value={imovel.idade_aparente}
                      options={["", ...IDADE_APARENTE_OPCOES]}
                      onChange={(v) => setImovelField("idade_aparente", v)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Posição Solar</Label>
                    <NativeSelect
                      value={imovel.posicao_solar}
                      options={["", ...POSICAO_SOLAR_OPCOES]}
                      onChange={(v) => setImovelField("posicao_solar", v)}
                    />
                  </div>
                  {(imovel.tipo === "Casa" || imovel.tipo === "Terreno") && (
                    <div className="space-y-2">
                      <Label>Topografia</Label>
                      <NativeSelect
                        value={imovel.topografia}
                        options={["", ...TOPOGRAFIA_OPCOES]}
                        onChange={(v) => setImovelField("topografia", v)}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Zoneamento</Label>
                    <Input
                      placeholder="Ex: ZR1, ZC, ZM"
                      value={imovel.zoneamento}
                      onChange={(e) => setImovelField("zoneamento", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vagas Cobertas</Label>
                    <Input
                      type="number"
                      placeholder="Opcional"
                      value={imovel.vagas_cobertas || ""}
                      onChange={(e) => setImovelField("vagas_cobertas", toNum(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vagas Descobertas</Label>
                    <Input
                      type="number"
                      placeholder="Opcional"
                      value={imovel.vagas_descobertas || ""}
                      onChange={(e) => setImovelField("vagas_descobertas", toNum(e.target.value))}
                    />
                  </div>
                  {imovel.tipo === "Apartamento" && (
                    <div className="space-y-2">
                      <Label>Total de Andares do Edifício</Label>
                      <Input
                        type="number"
                        placeholder="Opcional"
                        value={imovel.total_andares || ""}
                        onChange={(e) => setImovelField("total_andares", toNum(e.target.value))}
                      />
                    </div>
                  )}
                  {(imovel.tipo === "Casa" || imovel.tipo === "Sobrado") && (
                    <div className="space-y-2">
                      <Label>Número de Pavimentos</Label>
                      <NativeSelect
                        value={imovel.numero_pavimentos}
                        options={["", ...NUMERO_PAVIMENTOS_OPCOES]}
                        onChange={(v) => setImovelField("numero_pavimentos", v)}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>Tipo de Acabamento</Label>
                  <div className="flex flex-wrap gap-4">
                    {TIPO_ACABAMENTO_OPCOES.map((opcao) => (
                      <label key={opcao} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={imovel.tipo_acabamento.includes(opcao)}
                          onChange={() =>
                            safe(() =>
                              setImovel((prev) => ({
                                ...prev,
                                tipo_acabamento: prev.tipo_acabamento.includes(opcao)
                                  ? prev.tipo_acabamento.filter((c) => c !== opcao)
                                  : [...prev.tipo_acabamento, opcao],
                              })),
                            )
                          }
                          className="h-4 w-4 shrink-0 cursor-pointer rounded-sm accent-brand-gold"
                        />
                        <span className="text-sm">{opcao}</span>
                      </label>
                    ))}
                  </div>
                  <div className="space-y-2 pt-2">
                    <Label className="text-sm">Outros acabamentos (separe por vírgula)</Label>
                    <Input
                      placeholder="Ex: Pedra natural, Deck de madeira..."
                      value={imovel.acabamento_outros}
                      onChange={(e) => setImovelField("acabamento_outros", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Infraestrutura de Lazer</Label>
                  <div className="flex flex-wrap gap-4">
                    {INFRA_LAZER_OPCOES.map((opcao) => (
                      <label key={opcao} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={imovel.infraestrutura_lazer.includes(opcao)}
                          onChange={() =>
                            safe(() =>
                              setImovel((prev) => ({
                                ...prev,
                                infraestrutura_lazer: prev.infraestrutura_lazer.includes(opcao)
                                  ? prev.infraestrutura_lazer.filter((c) => c !== opcao)
                                  : [...prev.infraestrutura_lazer, opcao],
                              })),
                            )
                          }
                          className="h-4 w-4 shrink-0 cursor-pointer rounded-sm accent-brand-gold"
                        />
                        <span className="text-sm">{opcao}</span>
                      </label>
                    ))}
                  </div>
                  <div className="space-y-2 pt-2">
                    <Label className="text-sm">Outros itens de lazer (separe por vírgula)</Label>
                    <Input
                      placeholder="Ex: Rooftop, Espaço zen, Pista de skate..."
                      value={imovel.lazer_outros}
                      onChange={(e) => setImovelField("lazer_outros", e.target.value)}
                    />
                  </div>
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

            <div className="space-y-3 md:col-span-2">
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <Label className="text-base">Fotos do Imóvel</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Até {maxFotos} fotos · JPG, PNG ou WEBP · máx. 5MB cada · usadas pela IA na análise visual e no PDF.
                    {plano === "expert" && " Marque a foto principal com a estrela — ela vai para a capa do PDF."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={fotos.length >= maxFotos}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={16} /> Adicionar foto
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => safe(() => handleFotosSelected(e.target.files))}
                />
              </div>

              {fotos.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-lg py-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-brand-gold hover:text-brand-gold transition-colors"
                >
                  <Upload size={28} />
                  <span className="text-sm">Clique para enviar fotos do imóvel</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {fotos.map((f, i) => (
                    <div key={f.previewUrl} className="space-y-2">
                      <div className="relative group rounded-lg overflow-hidden border border-border aspect-[4/3] bg-muted">
                        <img src={f.previewUrl} alt={`Foto ${i + 1} do imóvel`} className="w-full h-full object-cover" />
                        {f.uploading && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs">
                            Enviando…
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            safe(() =>
                              setFotos((prev) =>
                                prev.map((p, idx) => ({ ...p, principal: idx === i ? !p.principal : false })),
                              ),
                            )
                          }
                          className={`absolute top-2 left-2 rounded-full p-1.5 ${
                            f.principal ? "bg-brand-gold text-white" : "bg-black/70 text-white hover:bg-brand-gold"
                          }`}
                          aria-label={f.principal ? "Foto principal" : "Marcar como foto principal"}
                          title={f.principal ? "Foto principal" : "Marcar como foto principal"}
                        >
                          <Star size={14} fill={f.principal ? "currentColor" : "none"} />
                        </button>
                        <button
                          type="button"
                          onClick={() => safe(() => removerFoto(i))}
                          className="absolute top-2 right-2 bg-black/70 hover:bg-destructive text-white rounded-full p-1.5 opacity-90"
                          aria-label="Remover foto"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Legenda da foto</Label>
                        <Input
                          placeholder="Ex: Sala de estar, Cozinha, Fachada, Varanda..."
                          value={f.legenda}
                          onChange={(e) =>
                            safe(() =>
                              setFotos((prev) =>
                                prev.map((p, idx) => (idx === i ? { ...p, legenda: e.target.value } : p)),
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  <Input
                    value={c.fonte}
                    onChange={(e) => updateComp(index, { fonte: extrairDominio(e.target.value) })}
                    placeholder="https://www.zapimoveis.com.br/..."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Localização / Referência</Label>
                  <Input value={c.localizacao} onChange={(e) => updateComp(index, { localizacao: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Área Total (m²)</Label>
                  <Input type="number" value={c.area}
                    onChange={(e) => updateComp(index, { area: toNum(e.target.value) })} />
                  {Number(c.valor) > 0 && (!c.area || Number(c.area) <= 0) && (
                    <p className="text-xs font-medium text-amber-600">
                      Informe a área para calcular o valor/m²
                    </p>
                  )}
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
                  {Number(c.valor) > 0 && Number(c.valor) < 10000 && (
                    <p className="text-xs font-medium text-destructive">
                      Valor muito baixo — verifique se esqueceu zeros
                    </p>
                  )}
                  {(() => {
                    const vpm2 = calcularValorM2(Number(c.valor), Number(c.area));
                    if (vpm2 === null) return null;
                    if (vpm2 < 500 || vpm2 > 50000) {
                      return (
                        <p className="text-xs font-medium text-amber-600">
                          Valor por m² fora do padrão — confira os dados
                        </p>
                      );
                    }
                    return null;
                  })()}
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
                  <NativeSelect value={c.padrao} options={PADROES} onChange={(v) => updateComp(index, { padrao: v })} />
                </div>
                {campos.conservacao && (
                  <div className="space-y-2">
                    <Label>Estado de Conservação</Label>
                    <NativeSelect value={c.conservacao} options={CONSERVACOES} onChange={(v) => updateComp(index, { conservacao: v })} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Posição</Label>
                  <NativeSelect value={c.posicao} options={POSICOES_COMPARAVEL} onChange={(v) => updateComp(index, { posicao: v })} />
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
                          <input
                            type="checkbox"
                            checked={c.caracteristicas.includes(opcao)}
                            onChange={() => toggleCompCaracteristica(index, opcao)}
                            className="h-4 w-4 shrink-0 cursor-pointer rounded-sm accent-brand-blue"
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
                disabled={comparaveis.some((c) => !c.fonte || !c.area || !c.valor || Number(c.valor) < 10000)}
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
        "Esta avaliação é mercadológica e não substitui laudo técnico aprovado por profissional habilitado (CNAI/IBAPE)"
      </p>
    </div>
  );
}
