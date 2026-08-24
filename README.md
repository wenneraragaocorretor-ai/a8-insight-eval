# A8 Property AI

Crie um aplicativo web completo chamado **A8 Investimentos Imobiliários** com o slogan "Gerando riqueza, construindo patrimônio". O app é uma plataforma SaaS para corretores e avaliadores de imóveis realizarem avaliações mercadológicas com auxílio de inteligência artificial.

---

## STACK TECNOLÓGICA

- Frontend: React + TypeScript + Tailwind CSS

- Backend/Banco de dados: Supabase (autenticação + PostgreSQL)

- Pagamentos: Stripe (planos de assinatura)

- IA: integração com API da Anthropic (Claude) via Supabase Edge Functions

- Geração de PDF: biblioteca jsPDF ou react-pdf

- Hospedagem: Vercel ou Netlify

---

## IDENTIDADE VISUAL

Estilo moderno, limpo e sofisticado — inspirado em fintechs premium.

- Cor primária: azul profundo (#0F2D5C) ou azul petróleo (#0A3D62)

- Cor de destaque/acento: dourado suave (#C8A951) para elementos premium

- Fundo: branco (#FFFFFF) e cinza clarinho (#F7F8FA)

- Tipografia: Inter ou Plus Jakarta Sans

- Ícones: Lucide React

- Cantos arredondados, espaçamento generoso, cards com sombra sutil

- Logo: texto "A8" em destaque com acento dourado, acompanhado de "Investimentos Imobiliários" menor

---

## AUTENTICAÇÃO (Supabase Auth)

- Tela de login e cadastro com e-mail + senha

- Campo adicional no cadastro: nome completo, CRECI (opcional), cidade/estado

- Redirecionamento para dashboard após login

- Proteção de rotas autenticadas

---

## PLANOS E ASSINATURA (Stripe)

Três planos de assinatura mensal:

**Plano Gratuito**

- Até 3 avaliações por mês

- Apenas Estudo de Mercado Simplificado (sem laudo formal)

- Sem exportação PDF

**Plano Profissional — R$ 79/mês**

- Avaliações ilimitadas

- Estudo de Mercado Completo com dicas de precificação e estratégias de venda

- Exportação em PDF do estudo de mercado

- Histórico de avaliações salvas

**Plano Expert — R$ 149/mês**

- Tudo do Profissional

- Laudo de Avaliação Mercadológica completo segundo metodologia da ABNT NBR 14653-2

- Homogeneização de dados, tratamento estatístico, campo de arbítrio

- PDF profissional com formatação de laudo técnico

- Marca d'água personalizável com nome do corretor/avaliador

- Destaque visual "Expert" no perfil

Criar página de planos com cards comparativos e botão de assinar via Stripe Checkout.

---

## TELAS E FUNCIONALIDADES

### 1. Landing Page (pública)

- Hero com nome, slogan e CTA "Começar grátis"

- Seção explicando os dois tipos de relatório (Estudo de Mercado x Laudo NBR)

- Seção de planos com comparativo

- Rodapé com informações da empresa

### 2. Dashboard (autenticado)

- Saudação com nome do corretor

- Cards de resumo: avaliações realizadas no mês, plano atual, laudos gerados

- Botão principal "Nova Avaliação"

- Lista das últimas avaliações com status (Estudo de Mercado / Laudo NBR) e botão para visualizar/baixar PDF

- Barra lateral com navegação: Dashboard, Nova Avaliação, Minhas Avaliações, Meu Plano, Perfil

### 3. Nova Avaliação — Passo 1: Dados do imóvel avaliando

Formulário com os campos:

- Tipo do imóvel (select): Apartamento, Casa, Terreno, Sala Comercial, Galpão, Outro

- Finalidade da avaliação (select): Venda, Locação, Garantia, Conhecimento

- Endereço / Localização (texto livre — bairro, cidade, estado)

- Área total (m²)

- Área privativa (m²) — opcional

- Número de quartos

- Número de banheiros

- Vagas de garagem

- Andar (se apartamento)

- Padrão construtivo (select): Simples, Normal, Alto, Luxo

- Estado de conservação (select): Novo, Bom, Regular, Ruim

- Características adicionais (checkboxes): Piscina, Churrasqueira, Elevador, Condomínio fechado, Área de lazer, Solar, Gerador

- Observações livres (textarea)

- Tipo de relatório desejado (select bloqueado por plano): Estudo de Mercado Simplificado, Estudo de Mercado Completo, Laudo NBR 14653-2

Botão "Próximo — Adicionar comparáveis"

### 4. Nova Avaliação — Passo 2: Cadastro de comparáveis

Interface para adicionar múltiplos imóveis comparáveis encontrados pelo corretor em portais imobiliários.

Para cada comparável, os campos são:

- Fonte / portal onde encontrou (texto: ex. Zap Imóveis, OLX, VivaReal)

- Endereço ou referência de localização

- Tipo do imóvel

- Área total (m²)

- Número de quartos

- Vagas de garagem

- Padrão construtivo

- Estado de conservação

- Valor anunciado (R$)

- Data da pesquisa

- Link do anúncio (opcional)

- Observações

Botão "Adicionar outro comparável" (mínimo 3, máximo 12).

Exibir os comparáveis já adicionados em cards resumidos com opção de editar ou remover.

Botão "Gerar avaliação com IA" (desabilitado até ter ao menos 3 comparáveis).

### 5. Nova Avaliação — Passo 3: Processamento pela IA

Tela de loading animada enquanto a IA processa.

Exibir mensagens de progresso: "Analisando os comparáveis...", "Calculando fatores de homogeneização...", "Gerando relatório..."

A chamada de IA deve ser feita via Supabase Edge Function que chama a API da Anthropic (Claude claude-sonnet-4-20250514).

O prompt enviado à IA deve:

Para Estudo de Mercado Simplificado:

- Calcular valor unitário médio (R$/m²) dos comparáveis

- Estimar valor de mercado do imóvel avaliando

- Retornar em JSON: valor_minimo, valor_central, valor_maximo, valor_unitario_medio, resumo_texto (2-3 parágrafos), dicas_anuncio (array com 5 dicas práticas de como anunciar e precificar o imóvel)

Para Estudo de Mercado Completo:

- Tudo acima mais análise de mercado local, sazonalidade, tendências

- dicas_venda (array com 8 estratégias de venda e negociação)

- analise_comparativa (texto detalhado comparando o imóvel avaliando com os comparáveis)

Para Laudo NBR 14653-2:

- Homogeneização completa com fatores: oferta (0,9), área, padrão, conservação, localização, andar

- Cálculo estatístico: média, mediana, desvio padrão, coeficiente de variação

- Campo de arbítrio (±15%)

- Grau de fundamentação compatível com dados disponíveis

- Texto do laudo em seções formais conforme a norma

- Ressalvas técnicas obrigatórias

- Retornar JSON estruturado com todas as seções do laudo

### 6. Nova Avaliação — Passo 4: Resultado

Exibir o resultado da avaliação em tela com:

- Card de destaque com o valor de mercado estimado (mínimo / central / máximo)

- Tabela de comparáveis utilizados

- Análise gerada pela IA em texto formatado

- Dicas de anúncio/venda em cards visuais (ícone + texto)

- Para laudo NBR: todas as seções do laudo formatadas

- Botão "Baixar PDF" (disponível conforme plano)

- Botão "Salvar avaliação"

### 7. Minhas Avaliações

Listagem de todas as avaliações salvas com:

- Filtros por tipo, data, cidade

- Card por avaliação: endereço, tipo, data, valor estimado, tipo de relatório

- Botões: visualizar, baixar PDF, duplicar, excluir

### 8. Meu Plano

- Exibir plano atual com recursos incluídos

- Contador de avaliações do mês

- Botão para fazer upgrade

- Histórico de faturas (via Stripe portal)

### 9. Perfil

- Editar nome, CRECI, cidade, telefone

- Upload de logo/assinatura para aparecer no laudo PDF

- Alterar senha

---

## BANCO DE DADOS (Supabase)

Tabelas necessárias:

- `profiles`: id, user_id, nome, creci, cidade, estado, telefone, logo_url, plano, stripe_customer_id, created_at

- `avaliacoes`: id, user_id, tipo_relatorio, tipo_imovel, finalidade, localizacao, area_total, area_privativa, quartos, banheiros, vagas, andar, padrao, conservacao, caracteristicas (jsonb), observacoes, status, created_at

- `comparaveis`: id, avaliacao_id, fonte, localizacao, tipo, area, quartos, vagas, padrao, conservacao, valor_anunciado, data_pesquisa, link, observacoes

- `resultados`: id, avaliacao_id, valor_minimo, valor_central, valor_maximo, valor_unitario_medio, relatorio_json (jsonb), pdf_url, created_at

Row Level Security (RLS) ativado: cada usuário acessa apenas seus próprios dados.

---

## GERAÇÃO DO PDF

Para Estudo de Mercado: PDF simples e moderno com logo A8, dados do imóvel, tabela de comparáveis, valores estimados, dicas de anúncio.

Para Laudo NBR 14653-2: PDF com formatação técnica formal, cabeçalho com logo e dados do avaliador, seções numeradas conforme a norma, tabela de homogeneização, resultados estatísticos, campo de arbítrio, ressalvas, data e identificação do sistema.

---

## OBSERVAÇÕES FINAIS

- Responsivo para desktop e mobile

- Skeleton loaders durante carregamentos

- Toast notifications para feedbacks (sucesso, erro)

- Formulários com validação em tempo real (React Hook Form + Zod)

- Salvar rascunho automaticamente durante preenchimento

- Não solicitar matrícula, escritura ou IPTU em nenhum momento

- Sempre exibir aviso: "Esta avaliação é mercadológica e não substitui laudo técnico assinado por profissional habilitado (CNAI/IBAPE)"

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://a8-insight-eval.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/605a3853-d613-4c26-8372-1d3b2682f23b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
