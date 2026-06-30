-- ============================================================
-- Migration 004 — Storage: bucket inspecoes-fotos
-- Execute no Supabase SQL Editor
-- ============================================================

-- Criar o bucket (se ainda não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspecoes-fotos',
  'inspecoes-fotos',
  false,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Storage Policies
-- Caminho: {org_id}/{inspecao_id}/{tipo}-{timestamp}.ext
-- ============================================================

-- Leitura: qualquer usuário autenticado da mesma org
-- (o caminho começa com o org_id do usuário)
CREATE POLICY "storage_fotos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'inspecoes-fotos'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
  );

-- Upload: inspetor pode fazer upload no caminho da sua org
CREATE POLICY "storage_fotos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'inspecoes-fotos'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
    AND get_user_role() IN ('admin', 'inspetor')
  );

-- Update/Delete: apenas admin ou o próprio inspetor
CREATE POLICY "storage_fotos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'inspecoes-fotos'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
    AND get_user_role() IN ('admin', 'inspetor')
  );

CREATE POLICY "storage_fotos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'inspecoes-fotos'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
    AND get_user_role() IN ('admin', 'gestor')
  );
