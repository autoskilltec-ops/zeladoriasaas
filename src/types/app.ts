// ─── Enums ────────────────────────────────────────────────────────────────────
export type UserRole            = "admin" | "inspetor" | "gestor" | "zelador"
export type InspecaoStatus      = "rascunho" | "em_andamento" | "finalizada" | "cancelada"
export type LimpezaProgramada   = "sim" | "nao"
export type EpiStatus           = "sim" | "parcialmente" | "nao"
export type CriticidadeNivel    = "critico" | "alto" | "medio" | "baixo"
export type NcTipo              = "seguranca" | "limpeza" | "epi" | "estrutural" | "outro"
export type NcStatus            = "aberta" | "em_andamento" | "resolvida" | "cancelada"
export type ReconhecimentoNivel = "excelente" | "bom_exemplo" | "merece_reconhecimento"

// ─── Entidades base ───────────────────────────────────────────────────────────
export interface Local {
  id:        string
  nome:      string
  bloco:     string | null
  andar:     string | null
  descricao: string | null
}

export interface Usuario {
  id:    string
  nome:  string
  email: string
  role:  UserRole
  ativo: boolean
}

export interface CriterioAvaliacao {
  id:    string
  nome:  string
  peso:  number
  ordem: number
}

export interface ChecklistItem {
  id:          string
  descricao:   string
  obrigatorio: boolean
  ordem:       number
}

export interface EpiItem {
  id:          string
  nome:        string
  obrigatorio: boolean
  ordem:       number
}

// ─── Dados de cada step do formulário de inspeção ─────────────────────────────
export interface InspecaoStep1 {
  data_inspecao:      string          // YYYY-MM-DD
  local_id:           string
  inspetor_id:        string
  zelador_id:         string
  descricao_visita:   string
  limpeza_programada: LimpezaProgramada
}

export interface AvaliacaoItem {
  criterio_id: string
  nota:        number   // 1–5
  observacao:  string
}

export interface InspecaoStep2 {
  avaliacoes: AvaliacaoItem[]
}

export interface SegurancaResposta {
  item_id:  string
  conforme: boolean
}

export interface InspecaoStep3 {
  respostas: SegurancaResposta[]
}

export interface InspecaoStep4 {
  status_geral:     EpiStatus
  epis_ausentes:    string[]   // array de epi_id
  equipamentos_bons: boolean
  observacoes:      string
}

export interface NaoConformidade {
  tipo:              NcTipo
  descricao:         string
  criticidade:       CriticidadeNivel
  acao_corretiva:    string
  prazo_correcao:    string   // YYYY-MM-DD
  responsavel_id:    string
}

export interface InspecaoStep5 {
  houve_nc:          boolean
  nao_conformidades: NaoConformidade[]
}

export interface InspecaoStep6 {
  houve_destaque: boolean
  nivel:          ReconhecimentoNivel | null
  descricao:      string
}
