
-- 1) Coluna para armazenar caminhos das fotos no Storage
ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS fotos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Políticas de acesso no bucket privado 'avaliacoes-fotos'
-- Convenção de path: {user_id}/{arquivo}
CREATE POLICY "avaliacoes_fotos_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avaliacoes-fotos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avaliacoes_fotos_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avaliacoes-fotos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avaliacoes_fotos_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avaliacoes-fotos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avaliacoes_fotos_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avaliacoes-fotos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
