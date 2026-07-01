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
  if (value >= meta)          return "var(--forest-600)"
  if (value >= meta * 0.75)   return "#f59e0b"
  return "var(--danger)"
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

function DonutChart({ ncs }: { ncs: DashboardData["ncs_por_criticidade"] }) {
  const total = ncs.critico + ncs.alto + ncs.medio + ncs.baixo
  const segments = [
    { label: "Crítico", count: ncs.critico, color: "var(--danger)" },
    { label: "Alto",    count: ncs.alto,    color: "#f97316" },
    { label: "Médio",   count: ncs.medio,   color: "#f59e0b" },
    { label: "Baixo",   count: ncs.baixo,   color: "var(--forest-600)" },
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

      <div className="flex items-center gap-5">
        {/* SVG donut */}
        <div className="relative flex-shrink-0">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} fill="none" aria-hidden>
            {total === 0 ? (
              <circle cx={cx} cy={cx} r={r} stroke="var(--line)" strokeWidth="10" />
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
            <span
              className="text-[18px] leading-none"
              style={{
                fontFamily: "var(--font-jakarta, var(--font-geist-sans))",
                fontWeight: 700,
                color: "var(--ink-900)",
              }}
            >
              {total}
            </span>
            <span className="text-[9px] mt-0.5" style={{ color: "var(--ink-300)" }}>
              {total === 1 ? "aberta" : "abertas"}
            </span>
          </div>
        </div>

        {/* Legenda */}
        <div className="flex-1 space-y-2">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center gap-2.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: s.color }}
              />
              <span className="text-[12px] flex-1" style={{ color: "var(--ink-700)" }}>
                {s.label}
              </span>
              <span
                className="text-[12px] tabular-nums"
                style={{
                  fontFamily: "var(--font-jakarta, var(--font-geist-sans))",
                  fontWeight: 600,
                  color: "var(--ink-900)",
                }}
              >
                {s.count}
              </span>
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
  numericValue,
  goal,
}: {
  label:        string
  value:        string
  sub?:         string
  color?:       string
  numericValue?: number
  goal?:        number
}) {
  const progress =
    numericValue !== undefined && goal !== undefined
      ? Math.min((numericValue / goal) * 100, 100)
      : undefined

  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <span className="metric-value" style={{ color: color ?? "var(--ink-900)" }}>
        {value}
      </span>
      {progress !== undefined && (
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ background: "var(--line)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: color ?? "var(--forest-600)",
              transition: "width 0.6s ease",
            }}
          />
        </div>
      )}
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
        <div className="flex flex-col items-center gap-3 py-6">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "var(--sage-100)" }}
          >
            <BarChart2 size={22} style={{ color: "var(--forest-600)" }} aria-hidden />
          </div>
          <div className="text-center">
            <p
              className="text-[13px]"
              style={{
                fontFamily: "var(--font-jakarta, var(--font-geist-sans))",
                fontWeight: 600,
                color: "var(--ink-700)",
              }}
            >
              Nenhum dado ainda
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-300)" }}>
              Realize inspeções no período selecionado
            </p>
          </div>
        </div>
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
  const [periodo, setPeriodo] = useState<Periodo>("mes_atual")
  const [data,    setData]    = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

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

      {/* ── Filtro de período ────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
        {PERIODOS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriodo(p.value)}
            className={cn(
              "shrink-0 px-4 py-1.5 rounded-full text-[12px] border transition-colors whitespace-nowrap",
              periodo !== p.value && "bg-white",
            )}
            style={
              periodo === p.value
                ? {
                    background: "var(--forest-700)",
                    color: "#fff",
                    borderColor: "transparent",
                    fontFamily: "var(--font-jakarta, var(--font-geist-sans))",
                    fontWeight: 600,
                  }
                : { color: "var(--ink-500)", borderColor: "var(--line)" }
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Estado de erro ───────────────────────────────────────────────── */}
      {error && !loading && (
        <div role="alert" className="mb-3">
          {error === "Sem permissão para acessar o dashboard"
            ? "Você não tem permissão para ver o dashboard. Contate o administrador."
            : error}
        </div>
      )}

      {/* ── Skeleton / Conteúdo ──────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="metric-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="metric-card">
                <div className="h-2 rounded w-[70%]" style={{ background: "var(--line)" }} />
                <div className="h-7 rounded w-[50%]" style={{ background: "var(--line)" }} />
              </div>
            ))}
          </div>
          <div className="card h-[120px]" />
          <div className="card h-[200px]" />
        </div>
      ) : data ? (
        <>
          {/* ── KPIs ─────────────────────────────────────────────────────── */}
          <div className="metric-grid mb-3">
            <MetricCard
              label="Qualidade Limpeza"
              value={`${data.qualidade_media.toFixed(1)}%`}
              sub="Meta ≥ 90%"
              color={statusColor(data.qualidade_media, 90)}
              numericValue={data.qualidade_media}
              goal={90}
            />
            <MetricCard
              label="Conformidade EPIs"
              value={`${data.conformidade_epis.toFixed(1)}%`}
              sub="Meta 100%"
              color={statusColor(data.conformidade_epis, 100)}
              numericValue={data.conformidade_epis}
              goal={100}
            />
            <MetricCard
              label="NCs abertas"
              value={String(data.total_ncs_abertas)}
              sub="Não conformidades"
              color={data.total_ncs_abertas > 0 ? "var(--danger)" : "var(--forest-600)"}
            />
            <MetricCard
              label="Inspeções"
              value={String(data.total_inspecoes)}
              sub="No período"
            />
          </div>

          {/* ── Donut de NCs ─────────────────────────────────────────────── */}
          <DonutChart ncs={data.ncs_por_criticidade} />

          {/* ── Ranking de locais ────────────────────────────────────────── */}
          <RankingList locais={data.ranking_locais} />
        </>
      ) : null}

    </div>
  )
}
