"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  ShieldAlert,
  Trophy,
  User,
  Users,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useInspecaoStore } from "@/store/inspecaoStore"
import { IndiceCircular } from "@/components/inspecao/IndiceCircular"
import type { AvaliacaoItem, CriticidadeNivel, NaoConformidade, SegurancaResposta } from "@/types/app"

// ─── Constantes ───────────────────────────────────────────────────────────────

const CRIT_ORDER: Record<CriticidadeNivel, number> = {
  critico: 4, alto: 3, medio: 2, baixo: 1,
}

const CRIT_LABELS: Record<CriticidadeNivel, string> = {
  critico: "Crítico", alto: "Alto", medio: "Médio", baixo: "Baixo",
}

const RECONHECIMENTO_LABELS: Record<string, string> = {
  excelente:             "⭐ Excelente",
  bom_exemplo:           "👍 Bom exemplo",
  merece_reconhecimento: "🏆 Merece reconhecimento",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

function calcularIQL(avaliacoes: AvaliacaoItem[]): number {
  const rated = avaliacoes.filter((a) => a.nota > 0)
  if (!rated.length) return 0
  const soma = rated.reduce((acc, a) => acc + a.nota, 0)
  return (soma / (rated.length * 5)) * 100
}

function calcularConformidade(respostas: SegurancaResposta[]): number {
  if (!respostas.length) return 0
  return (respostas.filter((r) => r.conforme).length / respostas.length) * 100
}

function critMax(ncs: NaoConformidade[]): CriticidadeNivel | null {
  if (!ncs.length) return null
  return ncs.reduce((max, nc) =>
    CRIT_ORDER[nc.criticidade] > CRIT_ORDER[max.criticidade] ? nc : max,
  ).criticidade
}

// Cor do indicador de status nas linhas de resumo
type StatusColor = "green" | "yellow" | "orange" | "red"

function iqlStatus(v: number): StatusColor {
  if (v >= 90) return "green"
  if (v >= 75) return "yellow"
  return "red"
}

function conformidadeStatus(v: number): StatusColor {
  if (v >= 100) return "green"
  if (v >= 75)  return "yellow"
  return "red"
}

function ncStatus(count: number): StatusColor {
  return count === 0 ? "green" : "red"
}

function critStatus(nivel: CriticidadeNivel | null): StatusColor {
  if (!nivel)            return "green"
  if (nivel === "baixo") return "green"
  if (nivel === "medio") return "yellow"
  if (nivel === "alto")  return "orange"
  return "red"
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

// ─── StatusDot ────────────────────────────────────────────────────────────────

function StatusDot({ color }: { color: StatusColor }) {
  const bg: Record<StatusColor, string> = {
    green:  "#3dbf65",
    yellow: "#f59e0b",
    orange: "#f97316",
    red:    "#ef4444",
  }
  return (
    <div
      className="w-[8px] h-[8px] rounded-full shrink-0"
      style={{ background: bg[color] }}
      aria-hidden
    />
  )
}

// ─── ResumoRow ────────────────────────────────────────────────────────────────

function ResumoRow({
  icon,
  label,
  value,
  color,
}: {
  icon?:   React.ReactNode
  label:   string
  value:   string
  color?:  StatusColor
}) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-[#f0f2f1] last:border-b-0 last:pb-0">
      {icon && <span className="text-[var(--green-600)] shrink-0">{icon}</span>}
      <span className="text-[12px] text-[#6b7280] flex-1">{label}</span>
      <div className="flex items-center gap-1.5">
        {color && <StatusDot color={color} />}
        <span className="text-[12px] font-medium text-[#1a2e22] text-right">{value}</span>
      </div>
    </div>
  )
}

// ─── SuccessScreen ────────────────────────────────────────────────────────────

function SuccessScreen({
  onNova,
  onDashboard,
}: {
  onNova:      () => void
  onDashboard: () => void
}) {
  return (
    <div className="px-4 pt-12 pb-4 flex flex-col items-center text-center">
      <div
        className="w-[80px] h-[80px] rounded-full flex items-center justify-center mb-5"
        style={{ background: "var(--green-50)", border: "1.5px solid var(--green-100)" }}
      >
        <CheckCircle2 size={40} style={{ color: "var(--green-600)" }} strokeWidth={1.5} />
      </div>

      <h2 className="text-[22px] font-medium text-[#1a2e22] mb-1">
        Inspeção enviada!
      </h2>
      <p className="text-[13px] text-[#6b7280] mb-10 leading-[1.6] max-w-[260px]">
        A inspeção foi finalizada com sucesso e todos os dados foram registrados.
      </p>

      <div className="w-full space-y-2">
        <button type="button" onClick={onNova} className="btn-primary">
          <ClipboardCheck size={16} aria-hidden />
          Nova Inspeção
        </button>
        <button type="button" onClick={onDashboard} className="btn-secondary">
          Ver Dashboard
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResumoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = use(params)
  const router   = useRouter()
  const supabase = useRef(createClient()).current

  const {
    step1, step2, step3, step5, step6,
    resetInspecao,
  } = useInspecaoStore()

  // Nomes resolvidos via Supabase (IDs → texto legível)
  const [localNome,    setLocalNome]    = useState<string>("—")
  const [inspetorNome, setInspetorNome] = useState<string>("—")
  const [zeladorNome,  setZeladorNome]  = useState<string>("—")
  const [loadingNomes, setLoadingNomes] = useState(true)

  const [confirming,  setConfirming]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success,     setSuccess]     = useState(false)

  // ── Resolve IDs → nomes ───────────────────────────────────────────────────
  useEffect(() => {
    if (!step1) { setLoadingNomes(false); return }

    Promise.all([
      supabase
        .from("locais")
        .select("nome, bloco, andar")
        .eq("id", step1.local_id)
        .single(),
      supabase
        .from("usuarios")
        .select("nome")
        .eq("id", step1.inspetor_id)
        .single(),
      supabase
        .from("usuarios")
        .select("nome")
        .eq("id", step1.zelador_id)
        .single(),
    ]).then(([{ data: local }, { data: inspetor }, { data: zelador }]) => {
      if (local) {
        const partes = [local.nome, local.bloco, local.andar].filter(Boolean)
        setLocalNome(partes.join(" — "))
      }
      if (inspetor) setInspetorNome(inspetor.nome)
      if (zelador)  setZeladorNome(zelador.nome)
      setLoadingNomes(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Índices calculados ────────────────────────────────────────────────────
  const avaliacoes = step2?.avaliacoes ?? []
  const respostas  = step3?.respostas  ?? []
  const ncs        = step5?.nao_conformidades ?? []
  const houveNC    = step5?.houve_nc ?? false

  const iql          = calcularIQL(avaliacoes)
  const conformidade = calcularConformidade(respostas)
  const ncCount      = houveNC ? ncs.length : 0
  const critMaxNivel = houveNC ? critMax(ncs) : null

  const hasIQL    = avaliacoes.length > 0
  const hasSeg    = respostas.length  > 0

  // ── Confirmar e enviar ────────────────────────────────────────────────────
  async function handleConfirmar() {
    setSubmitError(null)
    setConfirming(true)

    let res: Response
    try {
      res = await fetch(`/api/inspecoes/${id}/finalizar`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
      })
    } catch {
      setSubmitError("Falha de conexão. Verifique sua internet e tente novamente.")
      setConfirming(false)
      return
    }

    const json = await res.json()
    if (!res.ok) {
      setSubmitError(json?.error ?? "Erro ao finalizar inspeção. Tente novamente.")
      setConfirming(false)
      return
    }

    setSuccess(true)
  }

  function handleNova() {
    resetInspecao()
    router.push("/inspecao")
  }

  function handleDashboard() {
    resetInspecao()
    router.push("/dashboard")
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <StepBar current={7} total={7} />

      {success ? (
        <SuccessScreen onNova={handleNova} onDashboard={handleDashboard} />
      ) : (
        <div className="px-4 pt-4 pb-2">

          {/* ── Card: dados da visita ──────────────────────────────────── */}
          <div className="card mb-3">
            <p className="card-title">
              <ClipboardCheck size={13} aria-hidden />
              Dados da visita
            </p>

            {loadingNomes ? (
              <div className="space-y-3 py-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <div className="w-[14px] h-[14px] rounded bg-[#f0f2f1] animate-pulse shrink-0" />
                    <div className="flex-1 h-3 rounded bg-[#f0f2f1] animate-pulse" />
                    <div className="w-[100px] h-3 rounded bg-[#f0f2f1] animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <ResumoRow
                  icon={<CalendarDays size={13} />}
                  label="Data da inspeção"
                  value={step1 ? formatDate(step1.data_inspecao) : "—"}
                />
                <ResumoRow
                  icon={<MapPin size={13} />}
                  label="Local"
                  value={localNome}
                />
                <ResumoRow
                  icon={<User size={13} />}
                  label="Responsável pela inspeção"
                  value={inspetorNome}
                />
                <ResumoRow
                  icon={<Users size={13} />}
                  label="Profissional lotado"
                  value={zeladorNome}
                />
              </>
            )}
          </div>

          {/* ── Card: índices de qualidade ─────────────────────────────── */}
          <div className="card mb-3">
            <p className="card-title">
              <ShieldAlert size={13} aria-hidden />
              Índices de qualidade
            </p>

            <div className="space-y-2.5">
              <IndiceCircular
                value={iql}
                hasData={hasIQL}
                tag="Qualidade da Limpeza"
                sublabel="Meta: ≥ 90%"
                size="sm"
              />
              <IndiceCircular
                value={conformidade}
                hasData={hasSeg}
                tag="Conformidade de Segurança"
                sublabel="Meta: 100%"
                size="sm"
              />
            </div>

            {/* NCs e criticidade como linhas abaixo dos círculos */}
            <div className="mt-3 pt-3 border-t border-[#f0f2f1]">
              <ResumoRow
                label="Não conformidades"
                value={houveNC ? `${ncCount} encontrada${ncCount !== 1 ? "s" : ""}` : "Nenhuma"}
                color={ncStatus(ncCount)}
              />
              <ResumoRow
                label="Criticidade mais alta"
                value={critMaxNivel ? CRIT_LABELS[critMaxNivel] : "—"}
                color={critStatus(critMaxNivel)}
              />
              <ResumoRow
                label="Qualidade da Limpeza"
                value={hasIQL ? `${Math.round(iql)}%` : "Não avaliada"}
                color={hasIQL ? iqlStatus(iql) : undefined}
              />
              <ResumoRow
                label="Conformidade de Segurança"
                value={hasSeg ? `${Math.round(conformidade)}%` : "Não avaliada"}
                color={hasSeg ? conformidadeStatus(conformidade) : undefined}
              />
            </div>
          </div>

          {/* ── Card: reconhecimento (se houver) ───────────────────────── */}
          {step6?.houve_destaque && step6.nivel && step6.nivel !== null && (
            <div className="card mb-4">
              <p className="card-title">
                <Trophy size={13} aria-hidden />
                Reconhecimento
              </p>
              <ResumoRow
                label="Nível"
                value={RECONHECIMENTO_LABELS[step6.nivel] ?? step6.nivel}
              />
              {step6.descricao && (
                <p className="mt-2 text-[12px] text-[#374151] leading-[1.5]">
                  "{step6.descricao}"
                </p>
              )}
            </div>
          )}

          {/* ── Erro de envio ─────────────────────────────────────────── */}
          {submitError && (
            <div
              role="alert"
              className="mb-3 px-3 py-2.5 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[12px] text-[#b91c1c]"
            >
              {submitError}
            </div>
          )}

          {/* ── Botões ────────────────────────────────────────────────── */}
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={confirming}
              className="btn-secondary"
              style={{ flex: "0 0 auto", width: "auto", paddingInline: "16px" }}
            >
              <span aria-hidden>←</span> Voltar
            </button>

            <button
              type="button"
              onClick={handleConfirmar}
              disabled={confirming}
              className="btn-primary flex-1"
            >
              {confirming ? (
                <>
                  <span
                    className="inline-block w-[15px] h-[15px] border-2 border-white border-t-transparent rounded-full animate-spin"
                    aria-hidden
                  />
                  Enviando…
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} aria-hidden />
                  Confirmar e Enviar
                </>
              )}
            </button>
          </div>

          <p className="text-center text-[11px] text-[#9ca3af] mt-1 leading-[1.5]">
            Ao confirmar, a inspeção será finalizada e não poderá ser editada.
          </p>

        </div>
      )}
    </div>
  )
}
