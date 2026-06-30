"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Plus, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useInspecaoStore } from "@/store/inspecaoStore"
import type { CriticidadeNivel, NaoConformidade, NcTipo, Usuario } from "@/types/app"

// ─── Constantes ───────────────────────────────────────────────────────────────

const NC_TIPOS: { value: NcTipo; label: string }[] = [
  { value: "seguranca",  label: "Segurança" },
  { value: "limpeza",    label: "Limpeza" },
  { value: "epi",        label: "EPI" },
  { value: "estrutural", label: "Estrutural" },
  { value: "outro",      label: "Outro" },
]

const CRITICIDADES: { value: CriticidadeNivel; label: string }[] = [
  { value: "critico", label: "Crítico" },
  { value: "alto",    label: "Alto" },
  { value: "medio",   label: "Médio" },
  { value: "baixo",   label: "Baixo" },
]

const NC_TIPO_LABELS: Record<NcTipo, string> = {
  seguranca:  "Segurança",
  limpeza:    "Limpeza",
  epi:        "EPI",
  estrutural: "Estrutural",
  outro:      "Outro",
}

const CRIT_LABELS: Record<CriticidadeNivel, string> = {
  critico: "Crítico",
  alto:    "Alto",
  medio:   "Médio",
  baixo:   "Baixo",
}

const EMPTY_FORM: Partial<NaoConformidade> = {
  tipo:           undefined,
  descricao:      "",
  criticidade:    undefined,
  acao_corretiva: "",
  prazo_correcao: "",
  responsavel_id: "",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatDate(iso: string) {
  if (!iso) return ""
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

function validateNC(data: Partial<NaoConformidade>): Record<string, string> {
  const e: Record<string, string> = {}
  if (!data.tipo)                                e.tipo           = "Selecione o tipo da ocorrência"
  if (!data.descricao?.trim())                   e.descricao      = "Informe a descrição"
  else if (data.descricao.trim().length < 5)     e.descricao      = "Mínimo 5 caracteres"
  if (!data.criticidade)                         e.criticidade    = "Selecione a criticidade"
  if (!data.acao_corretiva?.trim())              e.acao_corretiva = "Informe a ação corretiva"
  else if (data.acao_corretiva.trim().length < 5) e.acao_corretiva = "Mínimo 5 caracteres"
  if (!data.prazo_correcao)                      e.prazo_correcao = "Selecione o prazo"
  if (!data.responsavel_id)                      e.responsavel_id = "Selecione o responsável"
  return e
}

// ─── StepBar ──────────────────────────────────────────────────────────────────

function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="step-bar" role="progressbar" aria-valuenow={current} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn("step-dot", {
            "step-dot-done":    i + 1 < current,
            "step-dot-current": i + 1 === current,
            "step-dot-pending": i + 1 > current,
          })}
        />
      ))}
      <span className="step-label">{current}/{total}</span>
    </div>
  )
}

// ─── CritBadge ────────────────────────────────────────────────────────────────

function CritBadge({ nivel }: { nivel: CriticidadeNivel }) {
  return (
    <span className={cn("crit-badge", nivel)}>
      {CRIT_LABELS[nivel]}
    </span>
  )
}

// ─── NcCard ───────────────────────────────────────────────────────────────────

function NcCard({
  nc,
  index,
  usuarios,
  onRemove,
}: {
  nc:       NaoConformidade
  index:    number
  usuarios: Usuario[]
  onRemove: () => void
}) {
  const responsavel = usuarios.find((u) => u.id === nc.responsavel_id)

  return (
    <div className="card mb-2" style={{ padding: "11px 12px" }}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {/* Tipo + criticidade */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className="text-[10px] font-medium text-[#6b7280] bg-[#f0f2f1] px-2 py-0.5 rounded-full">
              {NC_TIPO_LABELS[nc.tipo]}
            </span>
            <CritBadge nivel={nc.criticidade} />
            <span className="text-[10px] text-[#9ca3af]">NC {index + 1}</span>
          </div>

          {/* Descrição */}
          <p className="text-[12px] text-[#1a2e22] line-clamp-2 mb-1.5 leading-[1.45]">
            {nc.descricao}
          </p>

          {/* Prazo + responsável */}
          <div className="flex items-center gap-3 text-[11px] text-[#6b7280]">
            <span>Prazo: {formatDate(nc.prazo_correcao)}</span>
            {responsavel && <span>Resp.: {responsavel.nome}</span>}
          </div>
        </div>

        {/* Botão remover */}
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#fee2e2] hover:bg-[#fecaca] transition-colors"
          aria-label={`Remover não conformidade ${index + 1}`}
        >
          <Trash2 size={13} className="text-[#ef4444]" />
        </button>
      </div>
    </div>
  )
}

// ─── NcForm ───────────────────────────────────────────────────────────────────

function NcForm({
  usuarios,
  loadingU,
  onSave,
  onCancel,
}: {
  usuarios: Usuario[]
  loadingU: boolean
  onSave:   (nc: NaoConformidade) => void
  onCancel: (() => void) | null
}) {
  const [data,   setData]   = useState<Partial<NaoConformidade>>({ ...EMPTY_FORM })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set<K extends keyof NaoConformidade>(key: K, value: NaoConformidade[K]) {
    setData((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => { const e = { ...prev }; delete e[key]; return e })
  }

  function handleSave() {
    const errs = validateNC(data)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    onSave(data as NaoConformidade)
    setData({ ...EMPTY_FORM })
    setErrors({})
  }

  function FieldError({ field }: { field: string }) {
    return errors[field] ? (
      <p className="mt-1 text-[11px] text-[#ef4444] flex items-center gap-1">
        <span aria-hidden>!</span> {errors[field]}
      </p>
    ) : null
  }

  const descLen  = (data.descricao ?? "").length
  const acaoLen  = (data.acao_corretiva ?? "").length

  return (
    <div className="card mb-3">
      <p className="card-title">
        <AlertTriangle size={13} aria-hidden />
        {onCancel ? "Nova não conformidade" : "Registrar não conformidade"}
      </p>

      <div className="space-y-4">

        {/* Tipo da ocorrência */}
        <div>
          <label className="field-label">
            Tipo da ocorrência <span className="req">*</span>
          </label>
          <select
            value={data.tipo ?? ""}
            onChange={(e) => set("tipo", e.target.value as NcTipo)}
            className={cn(
              "field-input",
              data.tipo     && "has-value",
              errors.tipo   && "!border-[#ef4444] !bg-[#fef2f2]",
            )}
          >
            <option value="">Selecione o tipo</option>
            {NC_TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <FieldError field="tipo" />
        </div>

        {/* Descrição */}
        <div>
          <label className="field-label">
            Descrição <span className="req">*</span>
            <span className="ml-auto text-[10px] text-[#9ca3af] font-normal normal-case tracking-normal">
              {descLen}/300
            </span>
          </label>
          <textarea
            rows={3}
            value={data.descricao ?? ""}
            onChange={(e) => set("descricao", e.target.value)}
            maxLength={300}
            placeholder="Descreva a não conformidade encontrada"
            className={cn(
              "field-input h-auto py-[9px] resize-none leading-[1.5]",
              data.descricao   && "has-value",
              errors.descricao && "!border-[#ef4444] !bg-[#fef2f2]",
            )}
          />
          <FieldError field="descricao" />
        </div>

        {/* Criticidade */}
        <div>
          <p className="field-label mb-2">
            Criticidade <span className="req">*</span>
          </p>
          <div className="crit-selector-grid">
            {CRITICIDADES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => set("criticidade", c.value)}
                aria-pressed={data.criticidade === c.value}
                className={cn("crit-pill", c.value, data.criticidade === c.value && "selected")}
              >
                {c.label}
              </button>
            ))}
          </div>
          <FieldError field="criticidade" />
        </div>

        {/* Ação corretiva */}
        <div>
          <label className="field-label">
            Ação corretiva recomendada <span className="req">*</span>
            <span className="ml-auto text-[10px] text-[#9ca3af] font-normal normal-case tracking-normal">
              {acaoLen}/300
            </span>
          </label>
          <textarea
            rows={3}
            value={data.acao_corretiva ?? ""}
            onChange={(e) => set("acao_corretiva", e.target.value)}
            maxLength={300}
            placeholder="Descreva a ação corretiva recomendada"
            className={cn(
              "field-input h-auto py-[9px] resize-none leading-[1.5]",
              data.acao_corretiva   && "has-value",
              errors.acao_corretiva && "!border-[#ef4444] !bg-[#fef2f2]",
            )}
          />
          <FieldError field="acao_corretiva" />
        </div>

        {/* Prazo para correção */}
        <div>
          <label className="field-label">
            Prazo para correção <span className="req">*</span>
          </label>
          <input
            type="date"
            min={todayISO()}
            value={data.prazo_correcao ?? ""}
            onChange={(e) => set("prazo_correcao", e.target.value)}
            className={cn(
              "field-input",
              data.prazo_correcao   && "has-value",
              errors.prazo_correcao && "!border-[#ef4444] !bg-[#fef2f2]",
            )}
          />
          <FieldError field="prazo_correcao" />
        </div>

        {/* Responsável */}
        <div>
          <label className="field-label">
            Responsável <span className="req">*</span>
          </label>
          <select
            value={data.responsavel_id ?? ""}
            onChange={(e) => set("responsavel_id", e.target.value)}
            disabled={loadingU}
            className={cn(
              "field-input",
              data.responsavel_id   && "has-value",
              errors.responsavel_id && "!border-[#ef4444] !bg-[#fef2f2]",
              loadingU              && "opacity-50 cursor-not-allowed",
            )}
          >
            <option value="">
              {loadingU ? "Carregando usuários…" : "Selecione o responsável"}
            </option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
          <FieldError field="responsavel_id" />
        </div>

      </div>

      {/* Botões do formulário */}
      <div className={cn("flex gap-2 mt-4", onCancel ? "flex-row" : "flex-col")}>
        <button
          type="button"
          onClick={handleSave}
          className="btn-primary"
          style={{ minHeight: "42px", fontSize: "13px" }}
        >
          Salvar não conformidade
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            style={{ width: "auto", paddingInline: "16px", fontSize: "13px" }}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NaoConformidadesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = use(params)
  const router   = useRouter()
  const supabase = useRef(createClient()).current

  const { setNCs } = useInspecaoStore()

  const [houveNC,     setHouveNC]     = useState<boolean | null>(null)
  const [ncs,         setNcs]         = useState<NaoConformidade[]>([])
  const [formAberto,  setFormAberto]  = useState(false)
  const [usuarios,    setUsuarios]    = useState<Usuario[]>([])
  const [loadingU,    setLoadingU]    = useState(true)
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Carrega usuários da organização ───────────────────────────────────────
  useEffect(() => {
    supabase
      .from("usuarios")
      .select("id, nome, email, role, ativo")
      .eq("ativo", true)
      .order("nome")
      .then(
        ({ data }) => { setUsuarios(data ?? []); setLoadingU(false) },
        ()         => setLoadingU(false),
      )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle houve NC ───────────────────────────────────────────────────────

  function handleHouveNC(value: boolean) {
    setHouveNC(value)
    if (value) {
      if (ncs.length === 0) setFormAberto(true)
    } else {
      setNcs([])
      setFormAberto(false)
    }
    setSubmitError(null)
  }

  // ── CRUD de NCs ───────────────────────────────────────────────────────────

  function handleSaveNC(nc: NaoConformidade) {
    setNcs((prev) => [...prev, nc])
    setFormAberto(false)
  }

  function handleRemoveNC(idx: number) {
    const next = ncs.filter((_, i) => i !== idx)
    setNcs(next)
    // Reabre o formulário se removeu a última NC
    if (next.length === 0) setFormAberto(true)
  }

  // ── Pode avançar quando: escolha feita + form fechado ────────────────────
  const canSubmit = houveNC !== null && !formAberto

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitError(null)
    setSubmitting(true)

    // "Não" → sem API call
    if (!houveNC) {
      setNCs({ houve_nc: false, nao_conformidades: [] })
      router.push(`/inspecao/${id}/reconhecimento`)
      return
    }

    // "Sim" sem NCs → reabre o formulário
    if (ncs.length === 0) {
      setFormAberto(true)
      setSubmitting(false)
      return
    }

    let res: Response
    try {
      res = await fetch("/api/nao-conformidades", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ inspecao_id: id, nao_conformidades: ncs }),
      })
    } catch {
      setSubmitError("Falha de conexão. Verifique sua internet e tente novamente.")
      setSubmitting(false)
      return
    }

    const json = await res.json()
    if (!res.ok) {
      setSubmitError(json?.error ?? "Erro ao salvar. Tente novamente.")
      setSubmitting(false)
      return
    }

    setNCs({ houve_nc: true, nao_conformidades: ncs })
    router.push(`/inspecao/${id}/reconhecimento`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <StepBar current={5} total={7} />

      <div className="px-4 pt-4 pb-2">

        {/* ── Toggle: houve não conformidades? ────────────────────────── */}
        <div className="card mb-3">
          <p className="card-title">
            <AlertTriangle size={13} aria-hidden />
            Não Conformidades
          </p>

          <p className="field-label mb-2">
            Houve não conformidades?
            <span className="req">*</span>
          </p>
          <div className="toggle-group">
            {(["Sim", "Não"] as const).map((label) => {
              const v = label === "Sim"
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleHouveNC(v)}
                  aria-pressed={houveNC === v}
                  className={cn("toggle-btn", houveNC === v && "active")}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── NCs já adicionadas ────────────────────────────────────────── */}
        {houveNC && ncs.length > 0 && (
          <div className="mb-1">
            <p className="text-[11px] font-medium text-[#6b7280] uppercase tracking-wide mb-2">
              {ncs.length} não conformidade{ncs.length !== 1 ? "s" : ""} registrada{ncs.length !== 1 ? "s" : ""}
            </p>
            {ncs.map((nc, idx) => (
              <NcCard
                key={idx}
                nc={nc}
                index={idx}
                usuarios={usuarios}
                onRemove={() => handleRemoveNC(idx)}
              />
            ))}
          </div>
        )}

        {/* ── Formulário de NC ──────────────────────────────────────────── */}
        {houveNC && formAberto && (
          <NcForm
            usuarios={usuarios}
            loadingU={loadingU}
            onSave={handleSaveNC}
            onCancel={ncs.length > 0 ? () => setFormAberto(false) : null}
          />
        )}

        {/* ── Botão: adicionar outra NC ─────────────────────────────────── */}
        {houveNC && !formAberto && ncs.length > 0 && (
          <button
            type="button"
            onClick={() => setFormAberto(true)}
            className="btn-secondary mb-3"
          >
            <Plus size={14} aria-hidden />
            Adicionar outra não conformidade
          </button>
        )}

        {/* ── Aviso: formulário aberto bloqueia o submit ────────────────── */}
        {formAberto && (
          <p className="text-center text-[11px] text-[#9ca3af] mb-3 leading-[1.5]">
            Salve ou cancele a não conformidade atual para avançar.
          </p>
        )}

        {/* ── Erro de envio ─────────────────────────────────────────────── */}
        {submitError && (
          <div
            role="alert"
            className="mb-3 px-3 py-2.5 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[12px] text-[#b91c1c]"
          >
            {submitError}
          </div>
        )}

        {/* ── Botão avançar ─────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="btn-primary mb-2"
        >
          {submitting ? (
            <>
              <span
                className="inline-block w-[15px] h-[15px] border-2 border-white border-t-transparent rounded-full animate-spin"
                aria-hidden
              />
              Salvando…
            </>
          ) : (
            "Próximo: Reconhecimento →"
          )}
        </button>

        {/* Dica quando o toggle ainda não foi respondido */}
        {houveNC === null && (
          <p className="text-center text-[11px] text-[#9ca3af] mt-1">
            Responda se houve não conformidades para avançar.
          </p>
        )}

      </div>
    </div>
  )
}
