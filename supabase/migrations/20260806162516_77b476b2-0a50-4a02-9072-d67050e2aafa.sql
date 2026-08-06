-- Migração: Adiciona area_construida em avaliacoes e comparaveis
-- Adiciona também versao_metodologia em resultados para preservação de laudos históricos

ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS area_construida numeric;
ALTER TABLE public.comparaveis ADD COLUMN IF NOT EXISTS area_construida numeric;
ALTER TABLE public.resultados ADD COLUMN IF NOT EXISTS versao_metodologia integer DEFAULT 1;

-- Conceder permissões para os novos campos
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comparaveis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resultados TO authenticated;
