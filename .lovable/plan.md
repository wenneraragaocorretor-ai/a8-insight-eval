## Objetivo
Permitir que o corretor edite um laudo já concluído, regenere com a IA, mantendo controle de versões e limites por plano.

## 1. Banco de Dados (migração)

Adicionar colunas em `avaliacoes`:
- `edicoes_count` int default 0
- `ultima_edicao_em` timestamptz
- `editado` boolean default false

Criar tabela `avaliacoes_versoes` para histórico:
- `id`, `avaliacao_id` (FK), `versao` int, `snapshot` jsonb (cópia do avaliacao + comparaveis + resultado), `created_at`
- Grants + RLS (`auth.uid() = (select user_id from avaliacoes where id = avaliacao_id)`).

## 2. Server function (`src/lib/avaliacoes.functions.ts`)

Nova função `regerarAvaliacao`:
- Input: `id` + mesmo payload de `processarAvaliacaoIA`.
- Carrega plano e valida limite (Básico: 1, Profissional: 3, Expert: ilimitado) via `edicoes_count`.
- Snapshot da versão atual em `avaliacoes_versoes`.
- Re-invoca edge function `gerar-avaliacao`.
- `UPDATE avaliacoes` com novos campos + `edicoes_count + 1`, `ultima_edicao_em = now()`, `editado = true`.
- `DELETE` comparaveis antigos + `INSERT` novos.
- `UPDATE resultados` com novo relatório.
- NÃO conta no limite mensal de avaliações novas.

Ajustar `listarAvaliacoes` para retornar `editado` + `ultima_edicao_em` + `edicoes_count`.

## 3. Tela de resultado (`avaliacoes.$id.tsx`)

- Botão **"Editar Laudo"** ao lado de "Baixar PDF":
  - `variant="outline"`, ícone `Pencil`, cor azul `#0F2D5C`.
  - Visível para todos os planos.
  - Mostra badge cinza "X edição(ões) restante(s)" ou "Limite atingido".
  - Navega para `/avaliacoes/nova?edit=<id>`.

## 4. Formulário Nova Avaliação (`avaliacoes.nova.tsx`)

- Aceitar `?edit=<id>` via `validateSearch`.
- Em modo edição:
  - Loader carrega `getAvaliacaoDetalhe` e preenche `imovel`, `comparaveis`, `fotos` (com path + legenda + principal, sem reupload).
  - Título muda para "Editar Laudo" + subtítulo com versão atual.
  - Botão final muda para **"Regenerar Laudo"** (cor azul `#0F2D5C`).
  - Em vez de `processarAvaliacaoIA`, chama `regerarAvaliacao({ id, ...payload })`.
  - Após sucesso → volta para `/avaliacoes/<id>`.

## 5. Dashboard (`dashboard.index.tsx`)

Em cada card de avaliação:
- Ícone `Pencil` no canto.
- Se `editado === true`: badge dourado **"Revisado"**.
- Se `ultima_edicao_em`: linha "Editado em DD/MM/YYYY".

## 6. Detalhes técnicos
- Limite por plano: util `limiteEdicoes(plano)` → 1 / 3 / ∞.
- Versão snapshot inclui apenas dados serializáveis.
- Fotos: ao editar, reaproveitam paths já no storage; novos uploads como hoje; remover só remove da lista (não deleta storage, para preservar versão anterior).
- Badge "Atualizado" na tela de resultado quando `editado === true`.

## Arquivos a tocar
- `supabase/migrations/<novo>.sql` (nova migração)
- `src/lib/avaliacoes.functions.ts` (nova função + ajuste listar)
- `src/routes/_authenticated/avaliacoes.$id.tsx`
- `src/routes/_authenticated/avaliacoes.nova.tsx`
- `src/routes/_authenticated/dashboard.index.tsx`
