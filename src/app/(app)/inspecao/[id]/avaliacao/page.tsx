"use client"

import { use, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp, ClipboardList } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useInspecaoStore } from "@/store/inspecaoStore"
import { StarRating } from "@/components/inspecao/StarRating"
import { IndiceCircular } from "@/components/inspecao/IndiceCircular"
import type { CriterioAvaliacao } from "@/types/app"

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** IQL ponderado: considera apenas critérios com nota > 0. */
function calcularIQL(
  criterios: CriterioAvaliacao[],
  ratings: Record<string, number>,
): { value: number; hasData: boolean } {
  const avaliados = criterios.filter((c) => (ratings[c.id] ?? 0) > 0)
  if (avaliados.length === 0) return { value: 0, hasData: false }

  const sumNota = avaliados.reduce((acc, c) => acc + (ratings[c.id]! * c.peso), 0)
  const sumPeso = avaliados.reduce((acc, c) => acc + c.peso, 0)
  const raw     = (sumNota / (sumPeso * 5)) * 100

  return { value: Math.round(raw * 10) / 10, hasData: true }
}

// ─── Subcomponente: linha de critério ─────────────────────────────────────────
interface CriterioRowProps {
  criterio:     CriterioAvaliacao
  nota:         number
  observacao:   string
  obsExpanded:  boolean
  onNota:       (v: number) => void
  onObs:        (v: string) => void
  onToggleObs:  () => void
  isLast:       boolean
}

function CriterioRow({
  criterio,
  nota,
  observacao,
  obsExpanded,
  onNota,
  onObs,
  onToggleObs,
  isLast,
}: CriterioRowProps) {
  return (
    <div className={cn(!isLast && "border-b border-[#f0f2f1]")}>
      {/* Linha principal: nome + estrelas + botão obs */}
      <div className="rating-row" style={{ borderBottom: "none" }}>
        <span className="rating-label">{criterio.nome}</span>

        <div className="flex items-center gap-2">
          <StarRating value={nota} onChange={onNota} />

          {/* badge com a nota numérica */}
          <span
            className={cn(
              "rating-value w-[18px] text-right tabular-nums",
              nota === 0 && "text-[#d1d5db]",
            )}
            aria-live="polite"
          >
            {nota === 0 ? "—" : nota}
          </span>

          {/* toggle observação */}
          <button
            type="button"
            onClick={onToggleObs}
            className={cn(
              "w-[28px] h-[28px] rounded-full flex items-center justify-center transition-colors",
              obsExpanded
                ? "bg-[var(--green-50)] text-[var(--green-600)]"
                : "bg-[#f3f4f6] text-[#9ca3af]",
            )}
            aria-label={obsExpanded ? "Fechar observação" : "Adicionar observação"}
            aria-expanded={obsExpanded}
          >
            {obsExpanded
              ? <ChevronUp  size={13} aria-hidden />
              : <ChevronDown size={13} aria-hidden />
            }
          </button>
        </div>
      </div>

      {/* Área de observação expandível */}
      {obsExpanded && (
        <div className="pb-3 pt-0.5">
          <textarea
            rows={2}
            value={observacao}
            onChange={(e) => onObs(e.target.value)}
            placeholder="Observação sobre este critério (opcional)"
            maxLength={300}
            className="field-input h-auto py-[9px] resize-none leading-[1.5] text-[12px] w-full"
            aria-label={`Observação para ${criterio.nome}`}
          />
          <p className="text-[10px] text-[#9ca3af] text-right mt-0.5">
            {observacao.length}/300
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AvaliacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = use(params)
  const router   = useRouter()
  const supabase = useRef(createClient()).current

  const { setAvaliacao } = useInspecaoStore()

  const [criterios,    setCriterios]   = useState<CriterioAvaliacao[]>([])
  const [loading,      setLoading]     = useState(true)
  /** nota por criterio_id: 0 = não avaliado */
  const [ratings,      setRatings]     = useState<Record<string, number>>({})
  /** texto de observação por criterio_id */
  const [observacoes,  setObservacoes] = useState<Record<string, string>>({})
  /** set de IDs com painel de obs aberto */
  const [expanded,     setExpanded]    = useState<Set<string>>(new Set())
  const [submitting,   setSubmitting]  = useState(false)
  const [submitError,  setSubmitError] = useState<string | null>(null)

  // ── Carrega critérios da organização ──────────────────────────────────────
  useEffect(() => {
    supabase
      .from("criterios_avaliacao")
      .select("id, nome, peso, ordem")
      .eq("ativo", true)
      .order("ordem")
      .then(
        ({ data }) => {
          setCriterios(data ?? [])
          setLoading(false)
        },
        () => setLoading(false),
      )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── IQL em tempo real ─────────────────────────────────────────────────────
  const iql = useMemo(
    () => calcularIQL(criterios, ratings),
    [criterios, ratings],
  )

  const ratedCount = criterios.filter((c) => (ratings[c.id] ?? 0) > 0).length

  // ── Handlers ──────────────────────────────────────────────────────────────
  function setNota(criterioId: string, nota: number) {
    setRatings((prev) => ({ ...prev, [criterioId]: nota }))
  }

  function setObs(criterioId: string, obs: string) {
    setObservacoes((prev) => ({ ...prev, [criterioId]: obs }))
  }

  function toggleObs(criterioId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(criterioId) ? next.delete(criterioId) : next.add(criterioId)
      return next
    })
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitError(null)
    setSubmitting(true)

    const avaliacoes = criterios
      .filter((c) => (ratings[c.id] ?? 0) > 0)
      .map((c) => ({
        criterio_id:  c.id,
        nota:         ratings[c.id]!,
        observacao:   observacoes[c.id] ?? "",
      }))

    try {
      const res = await fetch("/api/avaliacoes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ inspecao_id: id, avaliacoes }),
      })

      const json = await res.json()

      if (!res.ok) {
        setSubmitError(json?.error ?? "Erro ao salvar avaliação. Tente novamente.")
        return
      }

      setAvaliacao({ avaliacoes })
      router.push(`/inspecao/${id}/seguranca`)
    } catch {
      setSubmitError("Falha de conexão. Verifique sua internet e tente novamente.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <StepBar current={2} total={7} />

      <div className="px-4 pt-4 pb-2">

        {/* ── Card de IQL em tempo real ─────────────────────────────────── */}
        <div className="mb-3">
          <IndiceCircular
            value={iql.value}
            hasData={iql.hasData}
            tag="Índice de Qualidade da Limpeza"
            sublabel="Meta: ≥ 90%"
          />
        </div>

        {/* ── Card de critérios ─────────────────────────────────────────── */}
        <div className="card mb-4">
          <p className="card-title">
            <ClipboardList size={13} aria-hidden />
            Avaliação dos critérios
            {ratedCount > 0 && (
              <span className="ml-auto normal-case text-[10px] font-normal tracking-normal text-[#9ca3af]">
                {ratedCount}/{criterios.length} avaliados
              </span>
            )}
          </p>

          {loading ? (
            /* skeleton de carregamento */
            <div className="space-y-4 py-1" aria-busy="true" aria-label="Carregando critérios">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-[13px] bg-[#f0f2f1] rounded flex-1 animate-pulse" />
                  <div className="h-[28px] w-[120px] bg-[#f0f2f1] rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : criterios.length === 0 ? (
            <p className="text-[13px] text-[#9ca3af] text-center py-4">
              Nenhum critério configurado para esta organização.
            </p>
          ) : (
            <div>
              {criterios.map((c, idx) => (
                <CriterioRow
                  key={c.id}
                  criterio={c}
                  nota={ratings[c.id] ?? 0}
                  observacao={observacoes[c.id] ?? ""}
                  obsExpanded={expanded.has(c.id)}
                  onNota={(v) => setNota(c.id, v)}
                  onObs={(v) => setObs(c.id, v)}
                  onToggleObs={() => toggleObs(c.id)}
                  isLast={idx === criterios.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* dica quando nenhum critério foi avaliado */}
        {!loading && criterios.length > 0 && ratedCount === 0 && (
          <p className="text-[11px] text-[#9ca3af] text-center mb-3 leading-[1.5]">
            Avalie ao menos um critério para calcular o IQL.
            <br />
            Você pode avançar sem avaliar — os critérios ficam em branco.
          </p>
        )}

        {/* erro de envio */}
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
          disabled={submitting || loading}
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
            "Próximo: Segurança →"
          )}
        </button>

      </div>
    </div>
  )
}
