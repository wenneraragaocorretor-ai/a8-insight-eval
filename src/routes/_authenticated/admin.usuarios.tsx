import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Loader2, Search } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";
import { listarUsuariosAdmin } from "../../lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: AdminUsuarios,
});

const planoLabel: Record<string, string> = {
  basico: "Básico",
  user: "Básico",
  profissional: "Profissional",
  pro: "Profissional",
  expert: "Expert",
};

function AdminUsuarios() {
  const fetchList = useServerFn(listarUsuariosAdmin);
  const [busca, setBusca] = useState("");
  const [aplicada, setAplicada] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-usuarios", aplicada],
    queryFn: () => fetchList({ data: { busca: aplicada, limit: 200 } }),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-brand-blue">Usuários</h2>

      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="text-base">Buscar</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAplicada(busca.trim());
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Buscar por nome ou e-mail"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-brand-blue text-white text-sm font-medium hover:opacity-90"
            >
              <Search className="h-4 w-4" /> Buscar
            </button>
          </form>
        </CardContent>
      </Card>

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
              Nenhum usuário encontrado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((u) => {
                  const ativo =
                    u.subscription_status === "active" ||
                    u.subscription_status === "trialing";
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.email ?? "—"}
                      </TableCell>
                      <TableCell>
                        {u.plano ? planoLabel[u.plano] ?? u.plano : "—"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            ativo
                              ? "bg-green-100 text-green-700"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {ativo ? "Ativo" : u.subscription_status ?? "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
