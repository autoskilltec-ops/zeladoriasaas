"use client"

import { use, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useInspecaoStore } from "@/store/inspecaoStore"
import { IndiceCircular } from "@/components/inspecao/IndiceCircular"
import type { ChecklistItem } from "@/types/app"

// ─── Itens padrão (fallback quando o banco não tem checklist configurado) ──────
const DEFAULT_ITEMS: ChecklistItem[] = [
  { id: "uniforme",     descricao: "Utiliza uniforme completo",                    obrigatorio: true,  ordem: 1 },
  { id: "calcado",      descricao: "Utiliza calçado de segurança",                 obrigatorio: true,  ordem: 2 },
  { id: "luvas",        descricao: "Utiliza luvas adequadas",                      obrigatorio: true,  ordem: 3 },
  { id: "oculos",       descricao: "Utiliza óculos de proteção (quando aplicável)", obrigatorio: false, ordem: 4 },
  { id: "mascara",      descricao: "Utiliza máscara (quando aplicável)",            obrigatorio: false, ordem: 5 },
  { id: "riscos",       descricao: "Conhece os riscos da atividade",               obrigatorio: true,  ordem: 6 },
  { id: "quimicos",     descricao: "Produtos químicos identificados corretamente",  obrigatorio: true,  ordem: 7 },
  { id: "equipamentos", descricao: "Equipamentos em boas condições",               obrigatorio: true,  ordem: 8 },
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

// ─── ChecklistRow ─────────────────────────────────────────────────────────────
function ChecklistRow({
  item,
  checked,
  onToggle,
}: {
  item:     ChecklistItem
  checked:  boolean
  onToggle: () => void
}) {
  return (
    <div
      className="checklist-item"
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          onToggle()
        }
      }}
    >
      <div className={cn("check-box", checked && "checked")} aria-hidden>
        {checked && <Check size={12} color="white" strokeWidth={3} />}
      </div>

      <span className="check-label">{item.descricao}</span>

      {!item.obrigatorio && (
        <span className="shrink-0 text-[10px] text-[#9ca3af]">opcional</span>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SegurancaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = use(params)
  const router   = useRouter()
  const supabase = useRef(createClient()).current

  const { setSeguranca } = useInspecaoStore()

  const [itens,       setItens]       = useState<ChecklistItem[]>([])
  const [loading,     setLoading]     = useState(true)
  /** IDs dos itens marcados como conformes */
  const [conformes,   setConformes]   = useState<Set<string>>(new Set())
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Carrega itens do checklist da organização ─────────────────────────────
  useEffect(() => {
    supabase
      .from("checklist_seguranca_itens")
      .select("id, descricao, obrigatorio, ordem")
      .eq("ativo", true)
      .order("ordem")
      .then(
        ({ data }) => {
          setItens(data?.length ? data : DEFAULT_ITEMS)
          setLoading(false)
        },
        () => {
          setItens(DEFAULT_ITEMS)
          setLoading(false)
        },
      )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Conformidade em tempo real ────────────────────────────────────────────
  // Cálculo: (marcados / total) × 100
  const conformidade = useMemo(() => {
    if (!itens.length) return 0
    return (conformes.size / itens.length) * 100
  }, [conformes, itens])

  const hasData      = !loading && itens.length > 0
  const allConform   = hasData && conformes.size === itens.length

  // ── Handlers ──────────────────────────────────────────────────────────────
  function toggle(id: string) {
    setConformes((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function marcarTodos() {
    setConformes(new Set(itens.map((i) => i.id)))
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitError(null)
    setSubmitting(true)

    const respostas = itens.map((item) => ({
      item_id:  item.id,
      conforme: conformes.has(item.id),
    }))

    let res: Response
    try {
      res = await fetch("/api/seguranca", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ inspecao_id: id, respostas }),
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

    setSeguranca({ respostas })
    router.push(`/inspecao/${id}/epis`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <StepBar current={3} total={7} />

      <div className="px-4 pt-4 pb-2">

        {/* ── Índice de conformidade em tempo real ───────────────────────── */}
        <div className="mb-3">
          <IndiceCircular
            value={conformidade}
            hasData={hasData}
            tag="Conformidade de Segurança"
            sublabel="Meta: 100%"
          />

          {/* Status "Conforme / Não Conforme" abaixo do círculo */}
          {hasData && (
            <p
              className={cn(
                "mt-2 text-center text-[12px] font-medium",
                allConform ? "text-[var(--green-700)]" : "text-[#ef4444]",
              )}
              aria-live="polite"
            >
              {allConform ? "✓ Conforme" : "✗ Não Conforme"}
            </p>
          )}
        </div>

        {/* ── Card: checklist ────────────────────────────────────────────── */}
        <div className="card mb-3">
          <p className="card-title">
            <ShieldCheck size={13} aria-hidden />
            Checklist de segurança
            {hasData && (
              <span className="ml-auto normal-case text-[10px] font-normal tracking-normal text-[#9ca3af]">
                {conformes.size}/{itens.length} itens
              </span>
            )}
          </p>

          {loading ? (
            /* skeleton de carregamento */
            <div className="space-y-0.5" aria-busy="true" aria-label="Carregando checklist">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 min-h-[44px] py-2">
                  <div className="w-[22px] h-[22px] rounded-[6px] bg-[#f0f2f1] animate-pulse shrink-0" />
                  <div className="h-3 bg-[#f0f2f1] rounded flex-1 animate-pulse" />
                </div>
              ))}
            </div>
          ) : itens.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-[#9ca3af]">
              Nenhum item configurado para esta organização.
            </p>
          ) : (
            <div role="group" aria-label="Itens do checklist de segurança">
              {itens.map((item) => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  checked={conformes.has(item.id)}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Atalho: marcar todos como conformes ────────────────────────── */}
        {hasData && !allConform && (
          <button
            type="button"
            onClick={marcarTodos}
            className="btn-secondary mb-3"
          >
            Marcar todos como conformes
          </button>
        )}

        {/* ── Erro de envio ───────────────────────────────────────────────── */}
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
            "Próximo: EPIs →"
          )}
        </button>

      </div>
    </div>
  )
}
