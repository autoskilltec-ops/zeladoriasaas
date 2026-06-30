"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, HardHat, Wrench } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useInspecaoStore } from "@/store/inspecaoStore"
import type { EpiItem, EpiStatus } from "@/types/app"

// ─── EPIs padrão (fallback quando o banco não tem itens configurados) ──────────
const DEFAULT_EPIS: EpiItem[] = [
  { id: "capacete",       nome: "Capacete de segurança",     obrigatorio: false, ordem: 1 },
  { id: "luvas",          nome: "Luvas de proteção",         obrigatorio: true,  ordem: 2 },
  { id: "oculos",         nome: "Óculos de proteção",        obrigatorio: false, ordem: 3 },
  { id: "mascara",        nome: "Máscara respiratória",      obrigatorio: false, ordem: 4 },
  { id: "avental",        nome: "Avental impermeável",       obrigatorio: true,  ordem: 5 },
  { id: "calcado",        nome: "Calçado de segurança",      obrigatorio: true,  ordem: 6 },
  { id: "protetor_auricular", nome: "Protetor auricular",    obrigatorio: false, ordem: 7 },
]

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

// ─── StatusEpiBtn ─────────────────────────────────────────────────────────────
// Botão individual para o toggle de 3 opções (Sim / Parcialmente / Não)
function StatusEpiBtn({
  value,
  label,
  current,
  colorActive,
  onClick,
}: {
  value:       EpiStatus
  label:       string
  current:     EpiStatus | null
  colorActive: string   // cor de fundo quando ativo (hex)
  onClick:     () => void
}) {
  const isActive = current === value
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        "toggle-btn flex-1",
        isActive && "active",
      )}
      style={
        isActive
          ? { background: colorActive, borderColor: colorActive, color: "#fff" }
          : undefined
      }
    >
      {label}
    </button>
  )
}

// ─── EpiCheckRow ──────────────────────────────────────────────────────────────
// Linha de seleção de EPI ausente (visual igual ao checklist de segurança)
function EpiCheckRow({
  epi,
  selected,
  onToggle,
}: {
  epi:      EpiItem
  selected: boolean
  onToggle: () => void
}) {
  return (
    <div
      className="checklist-item"
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          onToggle()
        }
      }}
    >
      <div className={cn("check-box", selected && "checked")} aria-hidden>
        {selected && <Check size={12} color="white" strokeWidth={3} />}
      </div>
      <span className="check-label">{epi.nome}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EpisPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = use(params)
  const router   = useRouter()
  const supabase = useRef(createClient()).current

  const { setEpis } = useInspecaoStore()

  const [epis,           setEpisList]      = useState<EpiItem[]>([])
  const [loading,        setLoading]       = useState(true)
  const [statusGeral,    setStatusGeral]   = useState<EpiStatus | null>(null)
  /** IDs dos EPIs marcados como ausentes */
  const [ausentes,       setAusentes]      = useState<Set<string>>(new Set())
  const [equipBons,      setEquipBons]     = useState<boolean | null>(null)
  const [observacoes,    setObservacoes]   = useState("")
  const [submitting,     setSubmitting]    = useState(false)
  const [submitError,    setSubmitError]   = useState<string | null>(null)

  // ── Carrega lista de EPIs da organização ──────────────────────────────────
  useEffect(() => {
    supabase
      .from("epis_lista")
      .select("id, nome, obrigatorio, ordem")
      .eq("ativo", true)
      .order("ordem")
      .then(
        ({ data }) => {
          setEpisList(data?.length ? data : DEFAULT_EPIS)
          setLoading(false)
        },
        () => {
          setEpisList(DEFAULT_EPIS)
          setLoading(false)
        },
      )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Limpa seleção de ausentes ao mudar para "Sim" ─────────────────────────
  function handleStatusGeral(v: EpiStatus) {
    setStatusGeral(v)
    if (v === "sim") setAusentes(new Set())
  }

  function toggleAusente(epiId: string) {
    setAusentes((prev) => {
      const next = new Set(prev)
      next.has(epiId) ? next.delete(epiId) : next.add(epiId)
      return next
    })
  }

  // ── Validação client-side ──────────────────────────────────────────────────
  const formValid = statusGeral !== null && equipBons !== null

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!formValid) return
    setSubmitError(null)
    setSubmitting(true)

    const payload = {
      inspecao_id:      id,
      status_geral:     statusGeral!,
      epis_ausentes:    [...ausentes],
      equipamentos_bons: equipBons!,
      observacoes,
    }

    let res: Response
    try {
      res = await fetch("/api/epis", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
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

    setEpis({
      status_geral:      statusGeral!,
      epis_ausentes:     [...ausentes],
      equipamentos_bons: equipBons!,
      observacoes,
    })
    router.push(`/inspecao/${id}/nao-conformidades`)
  }

  const showAusentes = statusGeral === "parcialmente" || statusGeral === "nao"

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <StepBar current={4} total={7} />

      <div className="px-4 pt-4 pb-2">

        {/* ── Card: Uso de EPIs ──────────────────────────────────────────── */}
        <div className="card mb-3">
          <p className="card-title">
            <HardHat size={13} aria-hidden />
            Uso de EPIs
          </p>

          {/* Toggle 3 opções */}
          <div className="mb-1">
            <p className="field-label mb-2">
              Todos os EPIs necessários estavam sendo utilizados?
              <span className="req">*</span>
            </p>
            <div className="flex gap-[7px]">
              <StatusEpiBtn
                value="sim"
                label="Sim"
                current={statusGeral}
                colorActive="#237a3c"
                onClick={() => handleStatusGeral("sim")}
              />
              <StatusEpiBtn
                value="parcialmente"
                label="Parcialmente"
                current={statusGeral}
                colorActive="#f97316"
                onClick={() => handleStatusGeral("parcialmente")}
              />
              <StatusEpiBtn
                value="nao"
                label="Não"
                current={statusGeral}
                colorActive="#ef4444"
                onClick={() => handleStatusGeral("nao")}
              />
            </div>
          </div>

          {/* EPIs ausentes — visível somente quando "Parcialmente" ou "Não" */}
          {showAusentes && (
            <div className="mt-4">
              <p className="field-label mb-2">
                Quais EPIs estavam ausentes?
              </p>

              {loading ? (
                <div className="space-y-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 min-h-[44px] py-2">
                      <div className="w-[22px] h-[22px] rounded-[6px] bg-[#f0f2f1] animate-pulse shrink-0" />
                      <div className="h-3 bg-[#f0f2f1] rounded flex-1 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                <div role="group" aria-label="EPIs ausentes">
                  {epis.map((epi) => (
                    <EpiCheckRow
                      key={epi.id}
                      epi={epi}
                      selected={ausentes.has(epi.id)}
                      onToggle={() => toggleAusente(epi.id)}
                    />
                  ))}
                </div>
              )}

              {ausentes.size > 0 && (
                <p className="mt-2 text-[11px] text-[#f97316]">
                  {ausentes.size} EPI{ausentes.size !== 1 ? "s" : ""} selecionado{ausentes.size !== 1 ? "s" : ""} como ausente{ausentes.size !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Card: Outras informações ───────────────────────────────────── */}
        <div className="card mb-4">
          <p className="card-title">
            <Wrench size={13} aria-hidden />
            Outras informações
          </p>

          {/* Equipamentos em boas condições */}
          <div className="mb-4">
            <p className="field-label mb-2">
              Equipamentos em boas condições?
              <span className="req">*</span>
            </p>
            <div className="toggle-group">
              {(
                [
                  { value: true,  label: "Sim" },
                  { value: false, label: "Não" },
                ] as const
              ).map(({ value, label }) => {
                const isActive = equipBons === value
                const isNo     = value === false
                return (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => setEquipBons(value)}
                    aria-pressed={isActive}
                    className={cn("toggle-btn", isActive && "active")}
                    style={
                      isActive && isNo
                        ? { background: "#ef4444", borderColor: "#ef4444", color: "#fff" }
                        : undefined
                    }
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="field-label" htmlFor="obs-epis">
              Observações
              <span className="ml-auto text-[10px] text-[#9ca3af] font-normal normal-case tracking-normal">
                {observacoes.length}/500
              </span>
            </label>
            <textarea
              id="obs-epis"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              maxLength={500}
              placeholder="Descreva observações adicionais sobre os EPIs ou equipamentos (opcional)"
              className={cn(
                "field-input h-auto py-[9px] resize-none leading-[1.5]",
                observacoes.length > 0 && "has-value",
              )}
            />
          </div>
        </div>

        {/* ── Erro de envio ──────────────────────────────────────────────── */}
        {submitError && (
          <div
            role="alert"
            className="mb-3 px-3 py-2.5 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[12px] text-[#b91c1c]"
          >
            {submitError}
          </div>
        )}

        {/* ── Botão avançar ───────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || loading || !formValid}
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
            "Próximo: Não Conformidades →"
          )}
        </button>

        {/* Dica enquanto campos obrigatórios não preenchidos */}
        {!formValid && !submitting && (
          <p className="text-center text-[11px] text-[#9ca3af] mt-1">
            Responda os campos obrigatórios para avançar.
          </p>
        )}

      </div>
    </div>
  )
}
