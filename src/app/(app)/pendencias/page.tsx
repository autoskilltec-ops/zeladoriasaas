"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ChevronRight, Clock, Play } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { CriticidadeNivel, InspecaoStatus } from "@/types/app"

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface InspecaoRascunho {
  id:             string
  status:         InspecaoStatus
  data_inspecao:  string
  created_at:     string
  local_nome:     string
}

interface NCAberta {
  id:             string
  tipo:           string
  descricao:      string
  criticidade:    CriticidadeNivel
  prazo_correcao: string
  local_nome:     string
  data_inspecao:  string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CRIT_LABELS: Record<CriticidadeNivel, string> = {
  critico: "Crítico",
  alto:    "Alto",
  medio:   "Médio",
  baixo:   "Baixo",
}

function formatDate(iso: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

function diasAteVencimento(iso: string): number {
  const hoje  = new Date()
  const prazo = new Date(iso + "T23:59:59")
  return Math.ceil((prazo.getTime() - hoje.getTime()) / 86400000)
}

function prazoColor(dias: number): string {
  if (dias < 0)  return "#ef4444"
  if (dias <= 3) return "#f97316"
  if (dias <= 7) return "#f59e0b"
  return "#6b7280"
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PendenciasPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [rascunhos, setRascunhos] = useState<InspecaoRascunho[]>([])
  const [ncs,       setNcs]       = useState<NCAberta[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [inspecoesRes, ncsRes] = await Promise.all([
        supabase
          .from("inspecoes")
          .select("id, status, data_inspecao, created_at, locais(nome, bloco)")
          .in("status", ["rascunho", "em_andamento"])
          .eq("inspetor_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("nao_conformidades")
          .select(`
            id, tipo, descricao, criticidade, prazo_correcao,
            inspecoes!inner(data_inspecao, locais(nome, bloco))
          `)
          .eq("responsavel_id", user.id)
          .eq("status", "aberta")
          .order("criticidade", { ascending: false })
          .order("prazo_correcao", { ascending: true }),
      ])

      const raws = (inspecoesRes.data ?? []).map((i: any) => ({
        id:            i.id,
        status:        i.status,
        data_inspecao: i.data_inspecao,
        created_at:    i.created_at,
        local_nome:    i.locais?.nome
          ? `${i.locais.nome}${i.locais.bloco ? ` — ${i.locais.bloco}` : ""}`
          : "Local não encontrado",
      }))

      const rawNcs = (ncsRes.data ?? []).map((nc: any) => ({
        id:             nc.id,
        tipo:           nc.tipo,
        descricao:      nc.descricao,
        criticidade:    nc.criticidade as CriticidadeNivel,
        prazo_correcao: nc.prazo_correcao,
        local_nome:     nc.inspecoes?.locais?.nome ?? "—",
        data_inspecao:  nc.inspecoes?.data_inspecao ?? "",
      }))

      setRascunhos(raws)
      setNcs(rawNcs)
      setLoading(false)
    }

    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="px-4 pt-4 space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card h-[72px]" />
        ))}
      </div>
    )
  }

  const empty = rascunhos.length === 0 && ncs.length === 0

  return (
    <div className="px-4 pt-4 pb-2">

      {empty && (
        <div className="flex flex-col items-center py-12 text-center">
          <div className="w-[60px] h-[60px] rounded-full bg-[var(--green-50)] border border-[var(--green-100)] flex items-center justify-center mb-4">
            <Clock size={28} style={{ color: "var(--green-500)" }} strokeWidth={1.5} />
          </div>
          <h3 className="text-[15px] font-medium text-[#1a2e22] mb-1">Nenhuma pendência</h3>
          <p className="text-[13px] text-[#9ca3af]">Tudo em dia!</p>
        </div>
      )}

      {/* ── Inspeções em rascunho/andamento ───────────────────────────── */}
      {rascunhos.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-medium text-[#6b7280] uppercase tracking-wide mb-2">
            Inspeções em andamento ({rascunhos.length})
          </p>

          <div className="space-y-2">
            {rascunhos.map((insp) => (
              <button
                key={insp.id}
                type="button"
                onClick={() => router.push(`/inspecao/${insp.id}/avaliacao`)}
                className="card w-full text-left"
                style={{ padding: "11px 12px" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--green-50)", border: "1px solid var(--green-100)" }}>
                    <Play size={13} style={{ color: "var(--green-600)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#1a2e22] truncate">{insp.local_nome}</p>
                    <p className="text-[11px] text-[#6b7280]">
                      {formatDate(insp.data_inspecao)} · {insp.status === "em_andamento" ? "Em andamento" : "Rascunho"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] font-medium text-[var(--green-700)]">Continuar</span>
                    <ChevronRight size={14} style={{ color: "var(--green-600)" }} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── NCs abertas ──────────────────────────────────────────────── */}
      {ncs.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-[#6b7280] uppercase tracking-wide mb-2">
            Não conformidades abertas ({ncs.length})
          </p>

          <div className="space-y-2">
            {ncs.map((nc) => {
              const dias  = diasAteVencimento(nc.prazo_correcao)
              const color = prazoColor(dias)

              return (
                <div key={nc.id} className="card" style={{ padding: "11px 12px" }}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: "#f97316" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={cn("crit-badge", nc.criticidade)}>
                          {CRIT_LABELS[nc.criticidade]}
                        </span>
                        <span className="text-[10px] text-[#9ca3af]">{nc.tipo}</span>
                      </div>
                      <p className="text-[12px] text-[#1a2e22] line-clamp-2 mb-1">{nc.descricao}</p>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-[#6b7280] truncate">{nc.local_nome}</span>
                        <span
                          className="shrink-0 font-medium"
                          style={{ color }}
                        >
                          {dias < 0
                            ? `Venceu há ${Math.abs(dias)}d`
                            : dias === 0
                              ? "Vence hoje"
                              : `${dias}d restantes`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
