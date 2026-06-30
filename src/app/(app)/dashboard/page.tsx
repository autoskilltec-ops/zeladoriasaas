"use client"

import { useEffect, useState } from "react"
import { BarChart2, AlertTriangle, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DashboardData {
  qualidade_media:    number
  conformidade_epis:  number
  total_ncs_abertas:  number
  ncs_por_criticidade: {
    critico: number
    alto:    number
    medio:   number
    baixo:   number
  }
  ranking_locais: {
    local_id:        string
    nome:            string
    media_qualidade: number
    total_inspecoes: number
  }[]
  total_inspecoes:   number
  periodo: { inicio: string; fim: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PERIODOS = [
  { value: "hoje",          label: "Hoje" },
  { value: "semana",        label: "Esta semana" },
  { value: "mes_atual",     label: "Mês atual" },
  { value: "mes_anterior",  label: "Mês anterior" },
] as const

type Periodo = typeof PERIODOS[number]["value"]

function statusColor(value: number, meta: number): string {
  if (value >= meta)           return "#3dbf65"
  if (value >= meta * 0.75)    return "#f59e0b"
  return "#ef4444"
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

function DonutChart({ ncs }: { ncs: DashboardData["ncs_por_criticidade"] }) {
  const total = ncs.critico + ncs.alto + ncs.medio + ncs.baixo
  const segments = [
    { label: "Crítico", count: ncs.critico, color: "#ef4444" },
    { label: "Alto",    count: ncs.alto,    color: "#f97316" },
    { label: "Médio",   count: ncs.medio,   color: "#f59e0b" },
    { label: "Baixo",   count: ncs.baixo,   color: "#3dbf65" },
  ]

  const SIZE = 80
  const r    = 28
  const cx   = SIZE / 2
  const circ = 2 * Math.PI * r

  let offset = 0
  const arcs = segments.map((s) => {
    const pct  = total > 0 ? s.count / total : 0
    const dash = pct * circ
    const curr = { ...s, pct, dashArray: dash, dashOffset: circ - offset }
    offset += dash
    return curr
  })

  return (
    <div className="card mb-3">
      <p className="card-title">
        <AlertTriangle size={13} aria-hidden />
        NCs por criticidade
      </p>

      <div className="flex items-center gap-4">
        {/* SVG donut */}
        <div className="relative flex-shrink-0">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} fill="none" aria-hidden>
            {total === 0 ? (
              <circle cx={cx} cy={cx} r={r} stroke="#e5e7eb" strokeWidth="10" />
            ) : (
              arcs.map((a, i) =>
                a.count > 0 ? (
                  <circle
                    key={i}
                    cx={cx} cy={cx} r={r}
                    stroke={a.color}
                    strokeWidth="10"
                    strokeDasharray={`${a.dashArray} ${circ - a.dashArray}`}
                    strokeDashoffset={a.dashOffset}
                    transform={`rotate(-90 ${cx} ${cx})`}
                    strokeLinecap="butt"
                  />
                ) : null
              )
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[18px] font-medium text-[#1a2e22] leading-none">{total}</span>
            <span className="text-[9px] text-[#9ca3af] mt-0.5">abertas</span>
          </div>
        </div>

        {/* Legenda */}
        <div className="flex-1 space-y-1.5">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className="w-[8px] h-[8px] rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-[12px] text-[#374151] flex-1">{s.label}</span>
              <span className="text-[12px] font-medium text-[#1a2e22]">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <span className="metric-value" style={{ color: color ?? "#1a2e22" }}>{value}</span>
      {sub && <span className="metric-sub">{sub}</span>}
    </div>
  )
}

// ─── RankingList ──────────────────────────────────────────────────────────────

function RankingList({ locais }: { locais: DashboardData["ranking_locais"] }) {
  const max = locais[0]?.media_qualidade ?? 100

  return (
    <div className="card">
      <p className="card-title">
        <TrendingUp size={13} aria-hidden />
        Ranking de setores
      </p>

      {locais.length === 0 ? (
        <p className="text-[13px] text-[#9ca3af] py-2 text-center">
          Nenhum dado no período
        </p>
      ) : (
        locais.map((local, idx) => (
          <div key={local.local_id} className="ranking-row">
            <span className="rank-num">{idx + 1}</span>
            <span className="rank-name truncate">{local.nome}</span>
            <div className="rank-bar-wrap">
              <div className="rank-bar-bg">
                <div
                  className="rank-bar-fill"
                  style={{ width: `${(local.media_qualidade / max) * 100}%` }}
                />
              </div>
            </div>
            <span className="rank-pct">{local.media_qualidade.toFixed(0)}%</span>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [periodo,   setPeriodo]   = useState<Periodo>("mes_atual")
  const [data,      setData]      = useState<DashboardData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    fetch(`/api/dashboard?periodo=${periodo}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error.message ?? "Erro ao carregar dados")
        else setData(json.data)
      })
      .catch(() => setError("Falha de conexão"))
      .finally(() => setLoading(false))
  }, [periodo])

  return (
    <div className="px-4 pt-4 pb-2">

      {/* ── Filtro de período ──────────────────────────────────────────── */}
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

      {/* ── Estado de erro ────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="mb-3 px-3 py-2.5 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[12px] text-[#b91c1c]">
          {error === "Sem permissão para acessar o dashboard"
            ? "Você não tem permissão para ver o dashboard. Contate o administrador."
            : error}
        </div>
      )}

      {/* ── Skeleton / Conteúdo ───────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="metric-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="metric-card">
                <div className="h-2 bg-[#e5e7eb] rounded w-[70%]" />
                <div className="h-7 bg-[#e5e7eb] rounded w-[50%]" />
              </div>
            ))}
          </div>
          <div className="card h-[120px]" />
          <div className="card h-[200px]" />
        </div>
      ) : data ? (
        <>
          {/* ── Cards de métricas ─────────────────────────────────────── */}
          <div className="metric-grid mb-3">
            <MetricCard
              label="Qualidade da Limpeza"
              value={`${data.qualidade_media.toFixed(1)}%`}
              sub="Meta ≥ 90%"
              color={statusColor(data.qualidade_media, 90)}
            />
            <MetricCard
              label="Conformidade de Segurança"
              value={`${data.conformidade_epis.toFixed(1)}%`}
              sub="Meta 100%"
              color={statusColor(data.conformidade_epis, 100)}
            />
            <MetricCard
              label="NCs abertas"
              value={String(data.total_ncs_abertas)}
              sub="Não conformidades"
              color={data.total_ncs_abertas > 0 ? "#ef4444" : "#3dbf65"}
            />
            <MetricCard
              label="Inspeções"
              value={String(data.total_inspecoes)}
              sub="No período"
            />
          </div>

          {/* ── Donut de NCs ──────────────────────────────────────────── */}
          <DonutChart ncs={data.ncs_por_criticidade} />

          {/* ── Ranking de locais ─────────────────────────────────────── */}
          <RankingList locais={data.ranking_locais} />
        </>
      ) : null}

    </div>
  )
}
