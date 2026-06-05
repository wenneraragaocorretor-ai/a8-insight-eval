CREATE TYPE public.user_role AS ENUM ('user', 'pro', 'expert');

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    creci TEXT,
    cidade TEXT,
    estado TEXT,
    telefone TEXT,
    logo_url TEXT,
    plano user_role DEFAULT 'user',
    stripe_customer_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.avaliacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo_relatorio TEXT NOT NULL,
    tipo_imovel TEXT NOT NULL,
    finalidade TEXT NOT NULL,
    localizacao TEXT NOT NULL,
    area_total NUMERIC,
    area_privativa NUMERIC,
    quartos INTEGER,
    banheiros INTEGER,
    vagas INTEGER,
    andar INTEGER,
    padrao TEXT,
    conservacao TEXT,
    caracteristicas JSONB DEFAULT '{}',
    observacoes TEXT,
    status TEXT DEFAULT 'rascunho',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes TO authenticated;
GRANT ALL ON public.avaliacoes TO service_role;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own evaluations" ON public.avaliacoes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.comparaveis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avaliacao_id UUID NOT NULL REFERENCES public.avaliacoes(id) ON DELETE CASCADE,
    fonte TEXT NOT NULL,
    localizacao TEXT,
    tipo TEXT,
    area NUMERIC,
    quartos INTEGER,
    vagas INTEGER,
    padrao TEXT,
    conservacao TEXT,
    valor_anunciado NUMERIC,
    data_pesquisa DATE,
    link TEXT,
    observacoes TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comparaveis TO authenticated;
GRANT ALL ON public.comparaveis TO service_role;
ALTER TABLE public.comparaveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own comparables" ON public.comparaveis FOR ALL USING (EXISTS (SELECT 1 FROM public.avaliacoes WHERE id = avaliacao_id AND user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.avaliacoes WHERE id = avaliacao_id AND user_id = auth.uid()));

CREATE TABLE public.resultados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avaliacao_id UUID NOT NULL REFERENCES public.avaliacoes(id) ON DELETE CASCADE,
    valor_minimo NUMERIC,
    valor_central NUMERIC,
    valor_maximo NUMERIC,
    valor_unitario_medio NUMERIC,
    relatorio_json JSONB,
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resultados TO authenticated;
GRANT ALL ON public.resultados TO service_role;
ALTER TABLE public.resultados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own results" ON public.resultados FOR ALL USING (EXISTS (SELECT 1 FROM public.avaliacoes WHERE id = avaliacao_id AND user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.avaliacoes WHERE id = avaliacao_id AND user_id = auth.uid()));
