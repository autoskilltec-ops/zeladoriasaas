"use client"

import { useEffect, useState } from "react"
import { Trophy } from "lucide-react"
import { cn } from "@/lib/utils"

interface Reconhecimento {
  id:              string
  nivel:           "excelente" | "bom_exemplo" | "merece_reconhecimento"
  descricao:       string
  created_at:      string
  zelador: {
    id:         string
    nome:       string
    avatar_url: string | null
  }
  inspecoes: {
    data_inspecao: string
    locais: {
      nome:  string
      bloco: string | null
    }
  }
}

const NIVEL_CONFIG = {
  excelente:             { emoji: "⭐", label: "Excelente",             bg: "#fef9c3", color: "#ca8a04" },
  bom_exemplo:           { emoji: "👍", label: "Bom exemplo",           bg: "#eff6ff", color: "#2563eb" },
  merece_reconhecimento: { emoji: "🏆", label: "Merece reconhecimento", bg: "var(--green-50)", color: "var(--green-700)" },
} as const

const FILTROS = [
  { value: "",                       label: "Todos" },
  { value: "merece_reconhecimento",  label: "🏆 Destaque" },
  { value: "excelente",              label: "⭐ Excelente" },
  { value: "bom_exemplo",            label: "👍 Bom exemplo" },
] as const

function formatDate(iso: string): string {
  if (!iso) return ""
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export default function MuralPage() {
  const [nivel,   setNivel]   = useState("")
  const [recs,    setRecs]    = useState<Reconhecimento[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const params = nivel ? `?nivel=${nivel}` : ""
    fetch(`/api/reconhecimentos${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error.message ?? "Erro ao carregar")
        else setRecs(json.data?.reconhecimentos ?? [])
      })
      .catch(() => setError("Falha de conexão"))
      .finally(() => setLoading(false))
  }, [nivel])

  return (
    <div className="px-4 pt-4 pb-2">

      {/* ── Filtro por nível ──────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-none">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setNivel(f.value)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-[12px] border transition-colors",
              nivel === f.value
                ? "bg-[var(--green-700)] text-white border-transparent"
                : "bg-white text-[#6b7280] border-[#e0e8e2]",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Conteúdo ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-[100px]" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-10">
          <p className="text-[13px] text-[#ef4444]">{error}</p>
        </div>
      ) : recs.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <div className="w-[60px] h-[60px] rounded-full bg-[var(--green-50)] border border-[var(--green-100)] flex items-center justify-center mb-4">
            <Trophy size={28} style={{ color: "var(--green-500)" }} strokeWidth={1.5} />
          </div>
          <h3 className="text-[15px] font-medium text-[#1a2e22] mb-1">Nenhum reconhecimento</h3>
          <p className="text-[13px] text-[#9ca3af]">
            Os destaques registrados em inspeções aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recs.map((rec) => {
            const cfg    = NIVEL_CONFIG[rec.nivel]
            const local  = rec.inspecoes?.locais
            const nomeLocal = local
              ? `${local.nome}${local.bloco ? ` — ${local.bloco}` : ""}`
              : "—"

            return (
              <div key={rec.id} className="card" style={{ padding: "13px 14px" }}>
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div
                    className="w-[40px] h-[40px] rounded-full flex items-center justify-center shrink-0 text-[16px] font-medium text-white"
                    style={{ background: "var(--green-700)" }}
                  >
                    {rec.zelador?.nome?.[0]?.toUpperCase() ?? "?"}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Nome + badge nível */}
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[13px] font-medium text-[#1a2e22]">
                        {rec.zelador?.nome ?? "—"}
                      </span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {cfg.emoji} {cfg.label}
                      </span>
                    </div>

                    {/* Local + data */}
                    <p className="text-[11px] text-[#6b7280] mb-1.5">
                      {nomeLocal} · {formatDate(rec.inspecoes?.data_inspecao ?? "")}
                    </p>

                    {/* Descrição */}
                    {rec.descricao && (
                      <p className="text-[12px] text-[#374151] leading-[1.5] italic">
                        "{rec.descricao}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
