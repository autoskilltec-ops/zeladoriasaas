-- ============================================================
-- SEED — Dados Iniciais por Organização
-- ============================================================
-- Execute APÓS criar a primeira organização via /cadastro.
-- Substitua 'ORG_ID' pelo UUID real da organização.
--
-- Para encontrar o ORG_ID:
--   SELECT id, nome FROM organizacoes;
-- ============================================================

-- Variável auxiliar (substitua pelo UUID real):
-- \set org_id 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

-- ============================================================
-- Critérios de avaliação padrão
-- ============================================================
INSERT INTO criterios_avaliacao (organizacao_id, nome, ordem, peso) VALUES
  ('ORG_ID', 'Limpeza do piso',           1, 1.00),
  ('ORG_ID', 'Limpeza de mobiliário',      2, 1.00),
  ('ORG_ID', 'Limpeza de banheiros',       3, 1.20),
  ('ORG_ID', 'Organização do ambiente',    4, 1.00),
  ('ORG_ID', 'Coleta de resíduos',         5, 1.00),
  ('ORG_ID', 'Conservação geral',          6, 0.80);

-- ============================================================
-- Checklist de segurança padrão
-- ============================================================
INSERT INTO checklist_seguranca_itens (organizacao_id, descricao, ordem, obrigatorio) VALUES
  ('ORG_ID', 'Utiliza uniforme completo',                       1, true),
  ('ORG_ID', 'Utiliza calçado de segurança',                    2, true),
  ('ORG_ID', 'Utiliza luvas adequadas',                         3, true),
  ('ORG_ID', 'Utiliza óculos de proteção (quando aplicável)',   4, false),
  ('ORG_ID', 'Utiliza máscara (quando aplicável)',              5, false),
  ('ORG_ID', 'Conhece os riscos da atividade',                  6, true),
  ('ORG_ID', 'Produtos químicos identificados corretamente',    7, true),
  ('ORG_ID', 'Equipamentos em boas condições',                  8, true);

-- ============================================================
-- Lista de EPIs padrão
-- ============================================================
INSERT INTO epis_lista (organizacao_id, nome, ordem, obrigatorio) VALUES
  ('ORG_ID', 'Luvas',              1, true),
  ('ORG_ID', 'Óculos de proteção', 2, false),
  ('ORG_ID', 'Máscara',           3, false),
  ('ORG_ID', 'Calçado de segurança', 4, true),
  ('ORG_ID', 'Uniforme',          5, true),
  ('ORG_ID', 'Avental',           6, true),
  ('ORG_ID', 'Protetor auricular', 7, false);

-- ============================================================
-- (Opcional) Local de exemplo
-- ============================================================
-- INSERT INTO locais (organizacao_id, nome, bloco, andar, tipo) VALUES
--   ('ORG_ID', 'Recepção Principal', 'A', 'Térreo', 'Recepção'),
--   ('ORG_ID', 'Corredor Bloco B',   'B', '1º',    'Corredor'),
--   ('ORG_ID', 'Banheiro Masculino', 'A', 'Térreo', 'Banheiro');
