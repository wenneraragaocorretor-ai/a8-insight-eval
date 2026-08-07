import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/test-ia")({
  component: AdminTestIA,
});

function AdminTestIA() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testGerarAvaliacao = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      // Dados fictícios para teste
      const payload = {
        imovel: {
          tipo: "Apartamento",
          finalidade: "Venda",
          localizacao: "Moema, São Paulo - SP",
          area_total: 100,
          area_privativa: 80,
          quartos: 3,
          suites: 1,
          banheiros: 2,
          vagas: 2,
          padrao: "Alto",
          conservacao: "Ótimo",
          fotos: []
        },
        comparaveis: [
          {
            fonte: "ZAP",
            localizacao: "Moema",
            area: 90,
            area_privativa: 80,
            valor: 1200000,
            quartos: 2,
            suites: 1,
            banheiros: 2,
            vagas: 1,
            padrao: "Alto",
            conservacao: "Bom"
          },
          {
            fonte: "VivaReal",
            localizacao: "Moema",
            area: 110,
            area_privativa: 95,
            valor: 1500000,
            quartos: 3,
            suites: 2,
            banheiros: 3,
            vagas: 2,
            padrao: "Alto",
            conservacao: "Ótimo"
          }
        ]
      };

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gerar-avaliacao`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      setResult({
        status: response.status,
        ok: response.ok,
        data
      });

      if (response.ok) {
        toast.success("Teste concluído com sucesso");
      } else {
        toast.error(`Erro ${response.status}: ${data.error || "Erro desconhecido"}`);
      }
    } catch (e: any) {
      toast.error(e.message);
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const testExtrairComparavel = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extrair-comparavel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ url: "https://www.google.com" }) // Teste de URL segura
      });

      const data = await response.json();
      setResult({
        status: response.status,
        ok: response.ok,
        data
      });

      if (response.ok) {
        toast.success("Extração testada (o Google pode bloquear scrapers, mas a função deve responder)");
      } else {
        toast.error(`Erro ${response.status}: ${data.error || "Erro desconhecido"}`);
      }
    } catch (e: any) {
      toast.error(e.message);
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-brand-blue mb-2">Auditoria Técnica de IA</h1>
        <p className="text-muted-foreground">
          Execute um teste real das funções gerar-avaliacao e extrair-comparavel usando dados fictícios válidos. Consulte os logs depois de cada execução e informe:
        </p>
        <ol className="list-decimal ml-6 mt-4 space-y-1 text-muted-foreground">
          <li>o status HTTP;</li>
          <li>se a Anthropic respondeu corretamente;</li>
          <li>o nome do modelo utilizado;</li>
          <li>qualquer erro encontrado.</li>
        </ol>
        <p className="mt-4 font-semibold text-destructive">
          Não revele, imprima nem registre o valor de ANTHROPIC_API_KEY.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Button onClick={testGerarAvaliacao} disabled={loading} className="bg-brand-blue">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Testar Gerar Avaliação
        </Button>
        <Button onClick={testExtrairComparavel} disabled={loading} variant="outline">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Testar Extrair Comparável
        </Button>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado do Teste</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-md overflow-auto max-h-[500px] text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
