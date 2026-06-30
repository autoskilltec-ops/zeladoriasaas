-- ============================================================
-- HABILITAR RLS EM TODAS AS TABELAS
-- ============================================================
ALTER TABLE organizacoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE locais                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_zeladores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE criterios_avaliacao    ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_seguranca_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE epis_lista             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspecoes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacoes_limpeza     ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguranca_checklist    ENABLE ROW LEVEL SECURITY;
ALTER TABLE epis_inspecao          ENABLE ROW LEVEL SECURITY;
ALTER TABLE epis_ausentes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE nao_conformidades      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconhecimentos        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: obter org_id do usuário atual
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organizacao_id FROM usuarios WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- HELPER: obter role do usuário atual
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM usuarios WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- POLICIES: organizacoes
-- ============================================================
-- Usuários veem apenas sua própria org
CREATE POLICY "organizacoes_select_own"
  ON organizacoes FOR SELECT
  USING (id = get_user_org_id());

-- Somente admin pode atualizar sua org
CREATE POLICY "organizacoes_update_admin"
  ON organizacoes FOR UPDATE
  USING (id = get_user_org_id() AND get_user_role() = 'admin');

-- ============================================================
-- POLICIES: usuarios
-- ============================================================
CREATE POLICY "usuarios_select_same_org"
  ON usuarios FOR SELECT
  USING (organizacao_id = get_user_org_id());

CREATE POLICY "usuarios_insert_admin"
  ON usuarios FOR INSERT
  WITH CHECK (
    organizacao_id = get_user_org_id()
    AND get_user_role() = 'admin'
  );

CREATE POLICY "usuarios_update_admin_or_self"
  ON usuarios FOR UPDATE
  USING (
    organizacao_id = get_user_org_id()
    AND (get_user_role() = 'admin' OR id = auth.uid())
  );

CREATE POLICY "usuarios_delete_admin"
  ON usuarios FOR DELETE
  USING (
    organizacao_id = get_user_org_id()
    AND get_user_role() = 'admin'
    AND id != auth.uid()  -- não pode deletar a si mesmo
  );

-- ============================================================
-- POLICIES: locais
-- ============================================================
CREATE POLICY "locais_select_same_org"
  ON locais FOR SELECT
  USING (organizacao_id = get_user_org_id());

CREATE POLICY "locais_insert_admin"
  ON locais FOR INSERT
  WITH CHECK (organizacao_id = get_user_org_id() AND get_user_role() = 'admin');

CREATE POLICY "locais_update_admin"
  ON locais FOR UPDATE
  USING (organizacao_id = get_user_org_id() AND get_user_role() = 'admin');

-- ============================================================
-- POLICIES: inspecoes
-- ============================================================
-- Admin e Gestor veem todas da org
-- Inspetor vê apenas as que criou
-- Zelador vê apenas as do seu local
CREATE POLICY "inspecoes_select"
  ON inspecoes FOR SELECT
  USING (
    organizacao_id = get_user_org_id()
    AND (
      get_user_role() IN ('admin', 'gestor')
      OR (get_user_role() = 'inspetor' AND inspetor_id = auth.uid())
      OR (
        get_user_role() = 'zelador'
        AND EXISTS (
          SELECT 1 FROM local_zeladores lz
          WHERE lz.local_id = inspecoes.local_id
            AND lz.usuario_id = auth.uid()
            AND lz.ativo = true
        )
      )
    )
  );

CREATE POLICY "inspecoes_insert_inspetor"
  ON inspecoes FOR INSERT
  WITH CHECK (
    organizacao_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'inspetor')
    AND inspetor_id = auth.uid()
  );

CREATE POLICY "inspecoes_update_inspetor_or_admin"
  ON inspecoes FOR UPDATE
  USING (
    organizacao_id = get_user_org_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'inspetor' AND inspetor_id = auth.uid() AND status != 'finalizada')
    )
  );

-- ============================================================
-- POLICIES: avaliacoes_limpeza (herda acesso da inspeção)
-- ============================================================
CREATE POLICY "avaliacoes_select"
  ON avaliacoes_limpeza FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inspecoes i
      WHERE i.id = avaliacoes_limpeza.inspecao_id
        AND i.organizacao_id = get_user_org_id()
    )
  );

CREATE POLICY "avaliacoes_insert"
  ON avaliacoes_limpeza FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM inspecoes i
      WHERE i.id = avaliacoes_limpeza.inspecao_id
        AND i.organizacao_id = get_user_org_id()
        AND i.inspetor_id = auth.uid()
        AND i.status != 'finalizada'
    )
  );

-- Aplicar mesmo padrão para: seguranca_checklist, epis_inspecao, epis_ausentes
CREATE POLICY "seguranca_select"
  ON seguranca_checklist FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inspecoes i
      WHERE i.id = seguranca_checklist.inspecao_id
        AND i.organizacao_id = get_user_org_id()
    )
  );

CREATE POLICY "seguranca_insert"
  ON seguranca_checklist FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM inspecoes i
      WHERE i.id = seguranca_checklist.inspecao_id
        AND i.inspetor_id = auth.uid()
        AND i.status != 'finalizada'
    )
  );

-- ============================================================
-- POLICIES: nao_conformidades
-- ============================================================
CREATE POLICY "nc_select"
  ON nao_conformidades FOR SELECT
  USING (organizacao_id = get_user_org_id());

CREATE POLICY "nc_insert"
  ON nao_conformidades FOR INSERT
  WITH CHECK (
    organizacao_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'inspetor')
  );

CREATE POLICY "nc_update"
  ON nao_conformidades FOR UPDATE
  USING (
    organizacao_id = get_user_org_id()
    AND (
      get_user_role() IN ('admin', 'gestor')
      OR responsavel_id = auth.uid()
    )
  );

-- ============================================================
-- POLICIES: reconhecimentos
-- ============================================================
CREATE POLICY "reconhecimentos_select"
  ON reconhecimentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inspecoes i
      WHERE i.id = reconhecimentos.inspecao_id
        AND i.organizacao_id = get_user_org_id()
    )
  );

CREATE POLICY "reconhecimentos_insert"
  ON reconhecimentos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM inspecoes i
      WHERE i.id = reconhecimentos.inspecao_id
        AND i.inspetor_id = auth.uid()
    )
  );
