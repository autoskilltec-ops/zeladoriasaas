-- ============================================================
-- EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'inspetor', 'gestor', 'zelador');
CREATE TYPE inspecao_status AS ENUM ('rascunho', 'em_andamento', 'finalizada', 'cancelada');
CREATE TYPE criticidade_nivel AS ENUM ('critico', 'alto', 'medio', 'baixo');
CREATE TYPE nc_tipo AS ENUM ('seguranca', 'limpeza', 'epi', 'estrutural', 'outro');
CREATE TYPE nc_status AS ENUM ('aberta', 'em_andamento', 'resolvida', 'cancelada');
CREATE TYPE epi_status AS ENUM ('sim', 'parcialmente', 'nao');
CREATE TYPE reconhecimento_nivel AS ENUM ('excelente', 'bom_exemplo', 'merece_reconhecimento');
CREATE TYPE limpeza_programada AS ENUM ('sim', 'nao');

-- ============================================================
-- TABELA: organizacoes (multi-tenant)
-- ============================================================
CREATE TABLE organizacoes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,  -- para URL amigável
  logo_url      TEXT,
  ativa         BOOLEAN NOT NULL DEFAULT true,
  meta_qualidade  NUMERIC(5,2) NOT NULL DEFAULT 90.00,  -- meta IQL em %
  meta_seguranca  NUMERIC(5,2) NOT NULL DEFAULT 100.00, -- meta conformidade em %
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: usuarios (estende auth.users do Supabase)
-- ============================================================
CREATE TABLE usuarios (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'inspetor',
  ativo         BOOLEAN NOT NULL DEFAULT true,
  avatar_url    TEXT,
  telefone      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: locais
-- ============================================================
CREATE TABLE locais (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizacao_id  UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,           -- ex: "Recepção - Bloco A"
  descricao       TEXT,
  bloco           TEXT,
  andar           TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: local_zeladores (zelador responsável por local)
-- ============================================================
CREATE TABLE local_zeladores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id        UUID NOT NULL REFERENCES locais(id) ON DELETE CASCADE,
  usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(local_id, usuario_id)
);

-- ============================================================
-- TABELA: criterios_avaliacao (configuráveis por organização)
-- ============================================================
CREATE TABLE criterios_avaliacao (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizacao_id  UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,     -- ex: "Limpeza do piso"
  descricao       TEXT,
  peso            NUMERIC(3,2) NOT NULL DEFAULT 1.00,  -- peso na média ponderada
  ordem           INTEGER NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: checklist_seguranca (itens configuráveis)
-- ============================================================
CREATE TABLE checklist_seguranca_itens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizacao_id  UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  descricao       TEXT NOT NULL,   -- ex: "Utiliza uniforme completo"
  obrigatorio     BOOLEAN NOT NULL DEFAULT true,
  ordem           INTEGER NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: epis_lista (EPIs configuráveis por organização)
-- ============================================================
CREATE TABLE epis_lista (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizacao_id  UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,   -- ex: "Luvas", "Óculos de proteção"
  obrigatorio     BOOLEAN NOT NULL DEFAULT true,
  ordem           INTEGER NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: inspecoes (registro principal)
-- ============================================================
CREATE TABLE inspecoes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizacao_id        UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  local_id              UUID NOT NULL REFERENCES locais(id),
  inspetor_id           UUID NOT NULL REFERENCES usuarios(id),   -- quem realizou
  zelador_id            UUID NOT NULL REFERENCES usuarios(id),   -- profissional lotado
  data_inspecao         DATE NOT NULL,
  hora_inicio           TIME,
  hora_fim              TIME,
  descricao_visita      TEXT,
  limpeza_programada    limpeza_programada NOT NULL DEFAULT 'nao',
  status                inspecao_status NOT NULL DEFAULT 'rascunho',
  -- Índices calculados (preenchidos ao finalizar)
  indice_qualidade      NUMERIC(5,2),   -- IQL em %
  indice_seguranca      NUMERIC(5,2),   -- CS em %
  -- Fotos
  foto_situacao_url     TEXT,
  foto_corretiva_url    TEXT,
  foto_final_url        TEXT,
  -- Metadata
  finalizada_em         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: avaliacoes_limpeza (notas por critério)
-- ============================================================
CREATE TABLE avaliacoes_limpeza (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspecao_id     UUID NOT NULL REFERENCES inspecoes(id) ON DELETE CASCADE,
  criterio_id     UUID NOT NULL REFERENCES criterios_avaliacao(id),
  nota            SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  observacao      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(inspecao_id, criterio_id)
);

-- ============================================================
-- TABELA: seguranca_checklist (respostas do checklist)
-- ============================================================
CREATE TABLE seguranca_checklist (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspecao_id     UUID NOT NULL REFERENCES inspecoes(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES checklist_seguranca_itens(id),
  conforme        BOOLEAN NOT NULL,
  observacao      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(inspecao_id, item_id)
);

-- ============================================================
-- TABELA: epis_inspecao (registro de EPIs na inspeção)
-- ============================================================
CREATE TABLE epis_inspecao (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspecao_id           UUID NOT NULL REFERENCES inspecoes(id) ON DELETE CASCADE,
  status_geral          epi_status NOT NULL DEFAULT 'sim',
  equipamentos_bons     BOOLEAN NOT NULL DEFAULT true,
  observacoes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(inspecao_id)
);

-- ============================================================
-- TABELA: epis_ausentes (EPIs ausentes na inspeção)
-- ============================================================
CREATE TABLE epis_ausentes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  epi_inspecao_id UUID NOT NULL REFERENCES epis_inspecao(id) ON DELETE CASCADE,
  epi_id          UUID NOT NULL REFERENCES epis_lista(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(epi_inspecao_id, epi_id)
);

-- ============================================================
-- TABELA: nao_conformidades
-- ============================================================
CREATE TABLE nao_conformidades (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspecao_id           UUID NOT NULL REFERENCES inspecoes(id) ON DELETE CASCADE,
  organizacao_id        UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  tipo                  nc_tipo NOT NULL,
  descricao             TEXT NOT NULL,
  criticidade           criticidade_nivel NOT NULL,
  acao_corretiva        TEXT NOT NULL,
  prazo_correcao        DATE NOT NULL,
  responsavel_id        UUID NOT NULL REFERENCES usuarios(id),
  status                nc_status NOT NULL DEFAULT 'aberta',
  resolucao_descricao   TEXT,
  resolvida_em          TIMESTAMPTZ,
  resolvida_por         UUID REFERENCES usuarios(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: reconhecimentos
-- ============================================================
CREATE TABLE reconhecimentos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspecao_id     UUID NOT NULL REFERENCES inspecoes(id) ON DELETE CASCADE,
  zelador_id      UUID NOT NULL REFERENCES usuarios(id),
  nivel           reconhecimento_nivel NOT NULL,
  descricao       TEXT,
  publicado_mural BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(inspecao_id)
);

-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================
CREATE INDEX idx_inspecoes_org ON inspecoes(organizacao_id);
CREATE INDEX idx_inspecoes_local ON inspecoes(local_id);
CREATE INDEX idx_inspecoes_inspetor ON inspecoes(inspetor_id);
CREATE INDEX idx_inspecoes_zelador ON inspecoes(zelador_id);
CREATE INDEX idx_inspecoes_data ON inspecoes(data_inspecao DESC);
CREATE INDEX idx_inspecoes_status ON inspecoes(status);
CREATE INDEX idx_nc_inspecao ON nao_conformidades(inspecao_id);
CREATE INDEX idx_nc_org ON nao_conformidades(organizacao_id);
CREATE INDEX idx_nc_status ON nao_conformidades(status);
CREATE INDEX idx_nc_criticidade ON nao_conformidades(criticidade);
CREATE INDEX idx_nc_prazo ON nao_conformidades(prazo_correcao);
CREATE INDEX idx_usuarios_org ON usuarios(organizacao_id);
CREATE INDEX idx_locais_org ON locais(organizacao_id);
CREATE INDEX idx_reconhecimentos_zelador ON reconhecimentos(zelador_id);

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizacoes_updated_at
  BEFORE UPDATE ON organizacoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_inspecoes_updated_at
  BEFORE UPDATE ON inspecoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_nc_updated_at
  BEFORE UPDATE ON nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- FUNÇÃO: calcular e salvar índices ao finalizar inspeção
-- ============================================================
CREATE OR REPLACE FUNCTION calcular_indices_inspecao(p_inspecao_id UUID)
RETURNS VOID AS $$
DECLARE
  v_iql NUMERIC(5,2);
  v_cs  NUMERIC(5,2);
BEGIN
  -- Índice de Qualidade da Limpeza (média ponderada)
  SELECT
    ROUND(
      (SUM(al.nota * ca.peso) / (SUM(ca.peso) * 5)) * 100
    , 2)
  INTO v_iql
  FROM avaliacoes_limpeza al
  JOIN criterios_avaliacao ca ON ca.id = al.criterio_id
  WHERE al.inspecao_id = p_inspecao_id;

  -- Conformidade de Segurança
  SELECT
    ROUND(
      (COUNT(*) FILTER (WHERE sc.conforme = true)::NUMERIC
       / NULLIF(COUNT(*), 0)) * 100
    , 2)
  INTO v_cs
  FROM seguranca_checklist sc
  WHERE sc.inspecao_id = p_inspecao_id;

  -- Atualiza inspeção
  UPDATE inspecoes
  SET
    indice_qualidade = COALESCE(v_iql, 0),
    indice_seguranca = COALESCE(v_cs, 0),
    status = 'finalizada',
    finalizada_em = NOW()
  WHERE id = p_inspecao_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
