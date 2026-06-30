"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { useInspecaoStore } from "@/store/inspecaoStore"
import type { ReconhecimentoNivel } from "@/types/app"

// ─── Opções de nível de reconhecimento ────────────────────────────────────────
const NIVEIS: {
  value: ReconhecimentoNivel | "nenhum"
  emoji: string
  label: string
}[] = [
  { value: "excelente",             emoji: "⭐", label: "Excelente" },
  { value: "bom_exemplo",           emoji: "👍", label: "Bom exemplo" },
  { value: "merece_reconhecimento", emoji: "🏆", label: "Merece reconhecimento" },
  { value: "nenhum",                emoji: "—",  label: "Nenhum" },
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

// ─── NivelOption ──────────────────────────────────────────────────────────────
function NivelOption({
  emoji,
  label,
  selected,
  onClick,
}: {
  emoji:    string
  label:    string
  selected: boolean
  onClick:  () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-[10px] border text-left transition-colors min-h-[52px]",
        selected
          ? "border-[var(--green-500)] bg-[var(--green-50)]"
          : "border-[#e5e7eb] bg-[#f8faf9] hover:border-[#d1d5db] hover:bg-[#f0f2f1]",
      )}
    >
      {/* Emoji */}
      <span className="text-[18px] w-[26px] text-center shrink-0 leading-none" aria-hidden>
        {emoji}
      </span>

      {/* Label */}
      <span
        className={cn(
          "flex-1 text-[13px]",
          selected ? "text-[var(--green-700)] font-medium" : "text-[#374151]",
        )}
      >
        {label}
      </span>

      {/* Indicador de radio */}
      <div
        className={cn(
          "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
          selected ? "border-[var(--green-500)]" : "border-[#d1d5db]",
        )}
        aria-hidden
      >
        {selected && (
          <div className="w-[8px] h-[8px] rounded-full bg-[var(--green-500)]" />
        )}
      </div>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReconhecimentoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const { setReconhecimento } = useInspecaoStore()

  const [houveDestaque, setHouveDestaque] = useState<boolean | null>(null)
  const [nivel,         setNivel]         = useState<ReconhecimentoNivel | "nenhum" | null>(null)
  const [descricao,     setDescricao]     = useState("")
  const [submitting,    setSubmitting]    = useState(false)
  const [submitError,   setSubmitError]   = useState<string | null>(null)

  // ── Toggle "houve destaque" ────────────────────────────────────────────────
  function handleHouveDestaque(value: boolean) {
    setHouveDestaque(value)
    if (!value) {
      setNivel(null)
      setDescricao("")
    }
    setSubmitError(null)
  }

  const canSubmit =
    houveDestaque === false ||
    (houveDestaque === true && nivel !== null)

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitError(null)
    setSubmitting(true)

    // Sem destaque ou nível "Nenhum" → sem chamada à API
    const nivelReal =
      houveDestaque && nivel !== "nenhum"
        ? (nivel as ReconhecimentoNivel)
        : null

    if (!houveDestaque || !nivelReal) {
      setReconhecimento({
        houve_destaque: houveDestaque ?? false,
        nivel:          nivelReal,
        descricao:      descricao.trim(),
      })
      router.push(`/inspecao/${id}/resumo`)
      return
    }

    let res: Response
    try {
      res = await fetch("/api/reconhecimentos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          inspecao_id: id,
          nivel:       nivelReal,
          descricao:   descricao.trim(),
        }),
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

    setReconhecimento({
      houve_destaque: true,
      nivel:          nivelReal,
      descricao:      descricao.trim(),
    })
    router.push(`/inspecao/${id}/resumo`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <StepBar current={6} total={7} />

      <div className="px-4 pt-4 pb-2">

        {/* ── Card: houve destaque positivo? ────────────────────────────── */}
        <div className="card mb-3">
          <p className="card-title">
            <Trophy size={13} aria-hidden />
            Reconhecimento
          </p>

          <p className="field-label mb-2">
            Houve algum destaque positivo?
            <span className="req">*</span>
          </p>
          <div className="toggle-group">
            {(["Sim", "Não"] as const).map((label) => {
              const v = label === "Sim"
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleHouveDestaque(v)}
                  aria-pressed={houveDestaque === v}
                  className={cn("toggle-btn", houveDestaque === v && "active")}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Card: seleção de nível + descrição ────────────────────────── */}
        {houveDestaque && (
          <div className="card mb-3">
            <p className="card-title">
              <Trophy size={13} aria-hidden />
              Nível do destaque
            </p>

            {/* Opções de nível */}
            <div
              className="space-y-2"
              role="radiogroup"
              aria-label="Selecione o nível do destaque"
            >
              {NIVEIS.map((n) => (
                <NivelOption
                  key={n.value}
                  emoji={n.emoji}
                  label={n.label}
                  selected={nivel === n.value}
                  onClick={() => setNivel(n.value)}
                />
              ))}
            </div>

            {/* Descrição — visível quando nível selecionado (exceto "Nenhum") */}
            {nivel && nivel !== "nenhum" && (
              <div className="mt-4">
                <label className="field-label" htmlFor="rec-descricao">
                  Descreva o destaque observado
                  <span className="ml-auto text-[10px] text-[#9ca3af] font-normal normal-case tracking-normal">
                    {descricao.length}/300
                  </span>
                </label>
                <textarea
                  id="rec-descricao"
                  rows={3}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  maxLength={300}
                  placeholder="Descreva o que foi observado de positivo (opcional)"
                  className={cn(
                    "field-input h-auto py-[9px] resize-none leading-[1.5]",
                    descricao.length > 0 && "has-value",
                  )}
                />
              </div>
            )}

            {/* Nota informativa sobre o Mural */}
            {nivel && nivel !== "nenhum" && (
              <div className="flex items-start gap-3 mt-3 px-3 py-2.5 rounded-[10px] bg-[var(--green-50)] border border-[var(--green-100)]">
                <Trophy
                  size={15}
                  className="text-[var(--green-600)] mt-0.5 shrink-0"
                  aria-hidden
                />
                <p className="text-[12px] text-[var(--green-700)] leading-[1.5]">
                  Esses registros alimentam o{" "}
                  <strong>Mural dos Craques da Zeladoria</strong>!
                </p>
              </div>
            )}
          </div>
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
            "Próximo: Resumo da Inspeção →"
          )}
        </button>

        {/* Dica enquanto não respondido */}
        {houveDestaque === null && (
          <p className="text-center text-[11px] text-[#9ca3af] mt-1">
            Responda se houve destaque positivo para avançar.
          </p>
        )}
        {houveDestaque === true && nivel === null && (
          <p className="text-center text-[11px] text-[#9ca3af] mt-1">
            Selecione o nível do destaque para avançar.
          </p>
        )}

      </div>
    </div>
  )
}
