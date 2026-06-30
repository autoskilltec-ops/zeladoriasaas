"use client"

import { useEffect, useState } from "react"
import { FileBarChart2, Download, AlertTriangle, ClipboardCheck } from "lucide-react"
import { cn } from "@/lib/utils"

interface InspecaoRelatorio {
  id:            string
  data_inspecao: string
  status:        string
  iql:           number | null
  cs:            number | null
  local_nome:    string
  inspetor_nome: string
}

interface NCRelatorio {
  id:             string
  tipo:           string
  descricao:      string
  criticidade:    string
  status:         string
  prazo_correcao: string
  local_nome:     string
  created_at:     string
}

const PERIODOS = [
  { value: "semana",       label: "Esta semana"   },
  { value: "mes_atual",   label: "Mês atual"      },
  { value: "mes_anterior",label: "Mês anterior"   },
  { value: "trimestre",   label: "Trimestre"      },
] as const

type Periodo = typeof PERIODOS[number]["value"]

const CRIT_COLORS: Record<string, string> = {
  critico: "#ef4444",
  alto:    "#f97316",
  medio:   "#f59e0b",
  baixo:   "#3dbf65",
}

function formatDate(iso: string) {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

function buildPeriodoRange(periodo: Periodo): { inicio: string; fim: string } {
  const now   = new Date()
  const yyyy  = now.getFullYear()
  const mm    = now.getMonth()

  let inicio: Date
  let fim:    Date

  if (periodo === "semana") {
    const dow = now.getDay()
    inicio = new Date(now); inicio.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1)); inicio.setHours(0,0,0,0)
    fim    = new Date(now); fim.setHours(23,59,59,999)
  } else if (periodo === "mes_atual") {
    inicio = new Date(yyyy, mm, 1)
    fim    = new Date(now); fim.setHours(23,59,59,999)
  } else if (periodo === "mes_anterior") {
    inicio = new Date(yyyy, mm - 1, 1)
    fim    = new Date(yyyy, mm,     0, 23, 59, 59, 999)
  } else {
    inicio = new Date(yyyy, mm - 2, 1)
    fim    = new Date(now); fim.setHours(23,59,59,999)
  }

  return {
    inicio: inicio.toISOString().split("T")[0],
    fim:    fim.toISOString().split("T")[0],
  }
}

export default function RelatoriosPage() {
  const [periodo,    setPeriodo]   = useState<Periodo>("mes_atual")
  const [inspecoes,  setInspecoes] = useState<InspecaoRelatorio[]>([])
  const [ncs,        setNcs]       = useState<NCRelatorio[]>([])
  const [loading,    setLoading]   = useState(true)
  const [aba,        setAba]       = useState<"inspecoes" | "ncs">("inspecoes")

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dashboard?periodo=${periodo}`)
      .then((r) => r.json())
      .then((json) => {
        /* dashboard data already loaded via API — now also load raw records */
      })
      .catch(() => {})

    const { inicio, fim } = buildPeriodoRange(periodo)

    Promise.all([
      fetch(`/api/relatorios/inspecoes?inicio=${inicio}&fim=${fim}`).then((r) => r.json()),
      fetch(`/api/relatorios/ncs?inicio=${inicio}&fim=${fim}`).then((r) => r.json()),
    ]).then(([insJson, ncsJson]) => {
      setInspecoes(insJson.data?.inspecoes ?? [])
      setNcs(ncsJson.data?.ncs ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [periodo])

  function downloadCSV(rows: Record<string, unknown>[], filename: string) {
    if (rows.length === 0) return
    const cols  = Object.keys(rows[0])
    const lines = [cols.join(";"), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(";"))]
    const blob  = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url   = URL.createObjectURL(blob)
    const a     = document.createElement("a")
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-4 pt-4 pb-6 max-w-2xl mx-auto">

      {/* ── Filtro de período ─────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-none">
        {PERIODOS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriodo(p.value)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-[12px] border transition-colors",
              periodo === p.value
                ? "bg-[var(--green-700)] text-white border-transparent"
                : "bg-white text-[#6b7280] border-[#e0e8e2]",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Abas ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-3 p-1 bg-[#f0f2f1] rounded-xl">
        {([
          { id: "inspecoes", label: "Inspeções",      Icon: ClipboardCheck },
          { id: "ncs",       label: "Não conformidades", Icon: AlertTriangle },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-colors",
              aba === id ? "bg-white text-[#1a2e22] shadow-sm" : "text-[#6b7280]",
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Botão exportar ────────────────────────────────────────────── */}
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => {
            if (aba === "inspecoes") {
              downloadCSV(inspecoes.map((i) => ({
                Data:      i.data_inspecao,
                Local:     i.local_nome,
                Inspetor:  i.inspetor_nome,
                Status:    i.status,
                IQL:       i.iql ?? "",
                CS:        i.cs ?? "",
              })), `inspecoes_${periodo}.csv`)
            } else {
              downloadCSV(ncs.map((n) => ({
                Data:        n.created_at.split("T")[0],
                Local:       n.local_nome,
                Tipo:        n.tipo,
                Descricao:   n.descricao,
                Criticidade: n.criticidade,
                Status:      n.status,
                Prazo:       n.prazo_correcao,
              })), `ncs_${periodo}.csv`)
            }
          }}
          disabled={loading || (aba === "inspecoes" ? inspecoes.length === 0 : ncs.length === 0)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[#e0e8e2] text-[#6b7280] hover:border-[var(--green-300)] hover:text-[var(--green-700)] transition-colors disabled:opacity-40"
        >
          <Download size={13} />
          Exportar CSV
        </button>
      </div>

      {/* ── Conteúdo ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1,2,3,4].map((i) => <div key={i} className="card h-[60px]" />)}
        </div>
      ) : aba === "inspecoes" ? (
        inspecoes.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <FileBarChart2 size={32} className="text-[#c4cdc7] mb-3" strokeWidth={1.5} />
            <p className="text-[13px] text-[#9ca3af]">Nenhuma inspeção no período</p>
          </div>
        ) : (
          <div className="space-y-2">
            {inspecoes.map((insp) => (
              <div key={insp.id} className="card" style={{ padding: "11px 12px" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#1a2e22] truncate">{insp.local_nome}</p>
                    <p className="text-[11px] text-[#9ca3af]">
                      {formatDate(insp.data_inspecao)} · {insp.inspetor_nome}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {insp.iql != null && (
                      <p className="text-[13px] font-medium text-[var(--green-700)]">
                        {Number(insp.iql).toFixed(0)}%
                      </p>
                    )}
                    <p className="text-[10px] text-[#9ca3af]">{insp.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        ncs.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <AlertTriangle size={32} className="text-[#c4cdc7] mb-3" strokeWidth={1.5} />
            <p className="text-[13px] text-[#9ca3af]">Nenhuma NC no período</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ncs.map((nc) => (
              <div key={nc.id} className="card" style={{ padding: "11px 12px" }}>
                <div className="flex items-start gap-2">
                  <div
                    className="w-[8px] h-[8px] rounded-full mt-1.5 shrink-0"
                    style={{ background: CRIT_COLORS[nc.criticidade] ?? "#9ca3af" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#1a2e22] line-clamp-1">{nc.descricao}</p>
                    <p className="text-[11px] text-[#9ca3af]">
                      {nc.local_nome} · {nc.tipo} · Prazo: {formatDate(nc.prazo_correcao)}
                    </p>
                  </div>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                    style={{
                      background: nc.status === "resolvida" ? "var(--green-50)" : "#fef2f2",
                      color:      nc.status === "resolvida" ? "var(--green-700)" : "#b91c1c",
                    }}
                  >
                    {nc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
