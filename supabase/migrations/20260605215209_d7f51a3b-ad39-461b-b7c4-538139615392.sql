ALTER TABLE public.avaliacoes 
ADD COLUMN IF NOT EXISTS padrao TEXT,
ADD COLUMN IF NOT EXISTS conservacao TEXT,
ADD COLUMN IF NOT EXISTS caracteristicas TEXT[],
ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Garantir que a tabela resultados suporte relatorio_json se for o caso
ALTER TABLE public.resultados
ADD COLUMN IF NOT EXISTS relatorio_json JSONB;
