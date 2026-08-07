CREATE TABLE IF NOT EXISTS public.ai_generation_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    idempotency_key uuid UNIQUE NOT NULL,
    correlation_id uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    provider text,
    model text,
    input_tokens integer,
    output_tokens integer,
    error_code text,
    error_message text,
    created_at timestamptz DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.ai_generation_requests TO authenticated;
GRANT ALL ON public.ai_generation_requests TO service_role;
ALTER TABLE public.ai_generation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generation requests" ON public.ai_generation_requests
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
