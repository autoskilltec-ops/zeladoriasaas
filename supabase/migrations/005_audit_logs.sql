-- ============================================================
-- Migration 005 — Tabela de Auditoria
-- Registra ações críticas para rastreabilidade e compliance.
-- Inserção exclusiva via service role (API routes) — imutável para usuários.
-- ============================================================

CREATE TABLE audit_logs (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        REFERENCES usuarios(id) ON DELETE SET NULL,
  organizacao_id UUID        REFERENCES organizacoes(id) ON DELETE SET NULL,
  action         TEXT        NOT NULL,       -- ex: 'inspecao.criar', 'nc.criar'
  resource_id    UUID,                       -- UUID do recurso afetado
  ip_address     TEXT,
  user_agent     TEXT,
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX idx_audit_org        ON audit_logs(organizacao_id);
CREATE INDEX idx_audit_user       ON audit_logs(user_id);
CREATE INDEX idx_audit_action     ON audit_logs(action);
CREATE INDEX idx_audit_created    ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_resource   ON audit_logs(resource_id) WHERE resource_id IS NOT NULL;

-- RLS: habilitado, somente admin/gestor pode ler; inserção apenas via service role
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_admin"
  ON audit_logs FOR SELECT
  USING (
    organizacao_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'gestor')
  );
-- INSERT é exclusivo do service role (sem policy de insert para usuários)
