import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { processarAvaliacaoIA } from "../../lib/avaliacoes.functions";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Sparkles, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/avaliacoes/nova")({
  component: NovaAvaliacao,
});

function NovaAvaliacao() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const processarIA = useServerFn(processarAvaliacaoIA);

  // Dados do Imóvel
  const [imovel, setImovel] = useState({
    tipo: "Apartamento",
    finalidade: "Venda",
    localizacao: "",
    area_total: 0,
    quartos: 0,
    banheiros: 0,
    vagas: 0,
    padrao: "Normal",
    conservacao: "Bom",
    caracteristicas: [] as string[],
    observacoes: "",
  });

  // Comparáveis
  const [comparaveis, setComparaveis] = useState([
    { id: 1, fonte: "", localizacao: "", area: 0, valor: 0 },
    { id: 2, fonte: "", localizacao: "", area: 0, valor: 0 },
    { id: 3, fonte: "", localizacao: "", area: 0, valor: 0 },
  ]);

  const addComparavel = () => {
    if (comparaveis.length < 12) {
      setComparaveis([...comparaveis, { id: Date.now(), fonte: "", localizacao: "", area: 0, valor: 0 }]);
    }
  };

  const removeComparavel = (id: number) => {
    if (comparaveis.length > 3) {
      setComparaveis(comparaveis.filter(c => c.id !== id));
    }
  };

  const handleProcessar = async () => {
    setIsLoading(true);
    try {
      const result = await processarIA({ 
        data: { 
          imovel, 
          comparaveis: comparaveis.map(({ id, ...rest }) => rest) 
        } 
      });
      toast.success("Avaliação concluída com sucesso!");
      navigate({ to: "/dashboard" }); // Por enquanto volta ao dashboard
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar avaliação");
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
              <Select value={imovel.tipo} onValueChange={(v) => setImovel({...imovel, tipo: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Apartamento">Apartamento</SelectItem>
                  <SelectItem value="Casa">Casa</SelectItem>
                  <SelectItem value="Terreno">Terreno</SelectItem>
                  <SelectItem value="Sala Comercial">Sala Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Localização (Bairro/Cidade)</Label>
              <Input placeholder="Ex: Itaim Bibi, São Paulo" value={imovel.localizacao} onChange={(e) => setImovel({...imovel, localizacao: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Área Total (m²)</Label>
              <Input type="number" value={imovel.area_total} onChange={(e) => setImovel({...imovel, area_total: Number(e.target.value)})} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Quartos</Label>
                <Input type="number" value={imovel.quartos} onChange={(e) => setImovel({...imovel, quartos: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <Label>Banheiros</Label>
                <Input type="number" value={imovel.banheiros} onChange={(e) => setImovel({...imovel, banheiros: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <Label>Vagas</Label>
                <Input type="number" value={imovel.vagas} onChange={(e) => setImovel({...imovel, vagas: Number(e.target.value)})} />
              </div>
            </div>
          </CardContent>
          <div className="p-6 border-t flex justify-end">
            <Button onClick={() => setStep(2)} className="bg-brand-blue gap-2">Próximo <ChevronRight size={18} /></Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-brand-blue">Imóveis Comparáveis (Mínimo 3)</h2>
          {comparaveis.map((c, index) => (
            <Card key={c.id} className="premium-card">
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Fonte (Ex: Zap)</Label>
                  <Input value={c.fonte} onChange={(e) => {
                    const newC = [...comparaveis];
                    newC[index].fonte = e.target.value;
                    setComparaveis(newC);
                  }} />
                </div>
                <div className="space-y-2">
                  <Label>Área (m²)</Label>
                  <Input type="number" value={c.area} onChange={(e) => {
                    const newC = [...comparaveis];
                    newC[index].area = Number(e.target.value);
                    setComparaveis(newC);
                  }} />
                </div>
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" value={c.valor} onChange={(e) => {
                    const newC = [...comparaveis];
                    newC[index].valor = Number(e.target.value);
                    setComparaveis(newC);
                  }} />
                </div>
                <div className="flex items-end pb-1 gap-2">
                  <Input placeholder="Local/Ref" value={c.localizacao} onChange={(e) => {
                    const newC = [...comparaveis];
                    newC[index].localizacao = e.target.value;
                    setComparaveis(newC);
                  }} />
                  <Button variant="ghost" size="icon" onClick={() => removeComparavel(c.id)} className="text-destructive"><Trash2 size={18} /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={() => addComparavel()} className="gap-2"><Plus size={18} /> Adicionar outro</Button>
            <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="gap-2"><ChevronLeft size={18} /> Voltar</Button>
              <Button onClick={() => setStep(3)} className="bg-brand-blue" disabled={comparaveis.some(c => !c.fonte || !c.area || !c.valor)}>Próximo</Button>
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
