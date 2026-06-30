-- ============================================================
-- Migration 003 — RLS Policies Complementares
-- Tabelas que tiveram RLS habilitado na migration 002 mas não
-- receberam policies explícitas. Sem policies, RLS bloqueia
-- todo acesso de usuários autenticados.
-- ============================================================

-- ============================================================
-- TABELA: criterios_avaliacao
-- Queried directly by the client in avaliacao/page.tsx
-- ============================================================
CREATE POLICY "criterios_select_same_org"
  ON criterios_avaliacao FOR SELECT
  USING (organizacao_id = get_user_org_id());

CREATE POLICY "criterios_insert_admin"
  ON criterios_avaliacao FOR INSERT
  WITH CHECK (organizacao_id = get_user_org_id() AND get_user_role() IN ('admin', 'gestor'));

CREATE POLICY "criterios_update_admin"
  ON criterios_avaliacao FOR UPDATE
  USING (organizacao_id = get_user_org_id() AND get_user_role() IN ('admin', 'gestor'));

CREATE POLICY "criterios_delete_admin"
  ON criterios_avaliacao FOR DELETE
  USING (organizacao_id = get_user_org_id() AND get_user_role() IN ('admin', 'gestor'));

-- ============================================================
-- TABELA: checklist_seguranca_itens
-- Queried directly by the client in seguranca/page.tsx
-- ============================================================
CREATE POLICY "checklist_seguranca_select_same_org"
  ON checklist_seguranca_itens FOR SELECT
  USING (organizacao_id = get_user_org_id());

CREATE POLICY "checklist_seguranca_insert_admin"
  ON checklist_seguranca_itens FOR INSERT
  WITH CHECK (organizacao_id = get_user_org_id() AND get_user_role() IN ('admin', 'gestor'));

CREATE POLICY "checklist_seguranca_update_admin"
  ON checklist_seguranca_itens FOR UPDATE
  USING (organizacao_id = get_user_org_id() AND get_user_role() IN ('admin', 'gestor'));

-- ============================================================
-- TABELA: epis_lista
-- Queried directly by the client in epis/page.tsx
-- ============================================================
CREATE POLICY "epis_lista_select_same_org"
  ON epis_lista FOR SELECT
  USING (organizacao_id = get_user_org_id());

CREATE POLICY "epis_lista_insert_admin"
  ON epis_lista FOR INSERT
  WITH CHECK (organizacao_id = get_user_org_id() AND get_user_role() IN ('admin', 'gestor'));

CREATE POLICY "epis_lista_update_admin"
  ON epis_lista FOR UPDATE
  USING (organizacao_id = get_user_org_id() AND get_user_role() IN ('admin', 'gestor'));

-- ============================================================
-- TABELA: local_zeladores
-- Queried directly by the client in inspecao/page.tsx (Step 1)
-- ============================================================
CREATE POLICY "local_zeladores_select_same_org"
  ON local_zeladores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM locais l
      WHERE l.id = local_zeladores.local_id
        AND l.organizacao_id = get_user_org_id()
    )
  );

CREATE POLICY "local_zeladores_insert_admin"
  ON local_zeladores FOR INSERT
  WITH CHECK (
    get_user_role() IN ('admin', 'gestor')
    AND EXISTS (
      SELECT 1 FROM locais l
      WHERE l.id = local_zeladores.local_id
        AND l.organizacao_id = get_user_org_id()
    )
  );

CREATE POLICY "local_zeladores_update_admin"
  ON local_zeladores FOR UPDATE
  USING (
    get_user_role() IN ('admin', 'gestor')
    AND EXISTS (
      SELECT 1 FROM locais l
      WHERE l.id = local_zeladores.local_id
        AND l.organizacao_id = get_user_org_id()
    )
  );

-- ============================================================
-- TABELA: epis_inspecao
-- Accessed only via API routes (service role bypasses RLS),
-- but adding read policy for zeladores who need to view.
-- ============================================================
CREATE POLICY "epis_inspecao_select"
  ON epis_inspecao FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inspecoes i
      WHERE i.id = epis_inspecao.inspecao_id
        AND i.organizacao_id = get_user_org_id()
    )
  );

CREATE POLICY "epis_inspecao_insert"
  ON epis_inspecao FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM inspecoes i
      WHERE i.id = epis_inspecao.inspecao_id
        AND i.inspetor_id = auth.uid()
        AND i.status != 'finalizada'
    )
  );

CREATE POLICY "epis_inspecao_update"
  ON epis_inspecao FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM inspecoes i
      WHERE i.id = epis_inspecao.inspecao_id
        AND i.inspetor_id = auth.uid()
        AND i.status != 'finalizada'
    )
  );

-- ============================================================
-- TABELA: epis_ausentes
-- ============================================================
CREATE POLICY "epis_ausentes_select"
  ON epis_ausentes FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM epis_inspecao ei
      JOIN inspecoes i ON i.id = ei.inspecao_id
      WHERE ei.id = epis_ausentes.epi_inspecao_id
        AND i.organizacao_id = get_user_org_id()
    )
  );

CREATE POLICY "epis_ausentes_insert"
  ON epis_ausentes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM epis_inspecao ei
      JOIN inspecoes i ON i.id = ei.inspecao_id
      WHERE ei.id = epis_ausentes.epi_inspecao_id
        AND i.inspetor_id = auth.uid()
        AND i.status != 'finalizada'
    )
  );

CREATE POLICY "epis_ausentes_delete"
  ON epis_ausentes FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM epis_inspecao ei
      JOIN inspecoes i ON i.id = ei.inspecao_id
      WHERE ei.id = epis_ausentes.epi_inspecao_id
        AND i.inspetor_id = auth.uid()
        AND i.status != 'finalizada'
    )
  );

-- ============================================================
-- TABELA: locais — ampliar policy de UPDATE/INSERT para gestor
-- (a policy original só permitia admin)
-- ============================================================
DROP POLICY IF EXISTS "locais_insert_admin" ON locais;
DROP POLICY IF EXISTS "locais_update_admin" ON locais;

CREATE POLICY "locais_insert_admin_gestor"
  ON locais FOR INSERT
  WITH CHECK (organizacao_id = get_user_org_id() AND get_user_role() IN ('admin', 'gestor'));

CREATE POLICY "locais_update_admin_gestor"
  ON locais FOR UPDATE
  USING (organizacao_id = get_user_org_id() AND get_user_role() IN ('admin', 'gestor'));

-- ============================================================
-- TABELA: locais — adicionar coluna "tipo"
-- (usada no painel admin para categorizar o local)
-- ============================================================
ALTER TABLE locais ADD COLUMN IF NOT EXISTS tipo TEXT;

-- ============================================================
-- TABELA: seguranca_checklist — policy de DELETE
-- (necessária para o upsert via delete+insert na API)
-- ============================================================
CREATE POLICY "seguranca_delete"
  ON seguranca_checklist FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM inspecoes i
      WHERE i.id = seguranca_checklist.inspecao_id
        AND i.inspetor_id = auth.uid()
        AND i.status != 'finalizada'
    )
  );

-- ============================================================
-- TABELA: avaliacoes_limpeza — policy de DELETE
-- (necessária para o upsert via delete+insert na API)
-- ============================================================
CREATE POLICY "avaliacoes_delete"
  ON avaliacoes_limpeza FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM inspecoes i
      WHERE i.id = avaliacoes_limpeza.inspecao_id
        AND i.inspetor_id = auth.uid()
        AND i.status != 'finalizada'
    )
  );
