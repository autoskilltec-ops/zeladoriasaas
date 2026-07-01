import { cn } from "@/lib/utils"

// ─── Classificação visual por faixa de valor ──────────────────────────────────
interface Cl {
  label:       string
  textColor:   string
  strokeColor: string
  trackColor:  string
  bgColor:     string
  borderColor: string
}

function classificar(value: number, hasData: boolean): Cl {
  if (!hasData) return {
    label: "Aguardando",
    textColor:   "#9ca3af",
    strokeColor: "#d1d5db",
    trackColor:  "#f3f4f6",
    bgColor:     "#f9fafb",
    borderColor: "#e5e7eb",
  }
  if (value >= 90) return {
    label: "Excelente",
    textColor:   "var(--forest-700)",
    strokeColor: "var(--forest-600)",
    trackColor:  "var(--sage-100)",
    bgColor:     "var(--sage-100)",
    borderColor: "rgba(42,112,72,.20)",
  }
  if (value >= 75) return {
    label: "Bom",
    textColor:   "var(--forest-600)",
    strokeColor: "#6dd98a",
    trackColor:  "var(--sage-100)",
    bgColor:     "var(--sage-100)",
    borderColor: "rgba(42,112,72,.15)",
  }
  if (value >= 60) return {
    label: "Regular",
    textColor:   "#d97706",
    strokeColor: "#f59e0b",
    trackColor:  "#fde68a",
    bgColor:     "#fefce8",
    borderColor: "#fde68a",
  }
  return {
    label: "Insatisfatório",
    textColor:   "var(--danger)",
    strokeColor: "#f87171",
    trackColor:  "#fecaca",
    bgColor:     "#fdf0ef",
    borderColor: "rgba(198,71,60,.20)",
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface IndiceCircularProps {
  /** 0–100 */
  value:      number
  /** "Índice de Qualidade da Limpeza", "Conformidade de Segurança" etc. */
  tag:        string
  /** "Meta: ≥ 90%", "Meta: 100%" etc. */
  sublabel:   string
  /** false quando nenhum critério foi avaliado ainda */
  hasData?:   boolean
  size?:      "sm" | "md"   // sm = 54 px, md = 64 px
  className?: string
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function IndiceCircular({
  value,
  tag,
  sublabel,
  hasData   = true,
  size      = "md",
  className,
}: IndiceCircularProps) {
  const dim   = size === "md" ? 64 : 54
  const r     = size === "md" ? 26 : 21
  const cx    = dim / 2
  const circ  = 2 * Math.PI * r
  const pct   = hasData ? Math.min(Math.max(value, 0), 100) : 0
  const offset = circ * (1 - pct / 100)
  const cl    = classificar(value, hasData)

  return (
    <div
      className={cn("index-block", className)}
      style={{ background: cl.bgColor, borderColor: cl.borderColor }}
    >
      {/* SVG circular */}
      <div className="index-circle-wrap">
        <svg
          width={dim}
          height={dim}
          viewBox={`0 0 ${dim} ${dim}`}
          fill="none"
          aria-hidden
        >
          {/* trilha de fundo */}
          <circle
            cx={cx} cy={cx} r={r}
            stroke={cl.trackColor}
            strokeWidth="6"
          />
          {/* arco de progresso */}
          <circle
            cx={cx} cy={cx} r={r}
            stroke={cl.strokeColor}
            strokeWidth="6"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cx})`}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>

        {/* texto central */}
        <div
          className="index-circle-text"
          style={{ color: cl.textColor, fontSize: size === "md" ? 14 : 12 }}
          aria-label={hasData ? `${Math.round(value)}%` : "sem dados"}
        >
          {hasData && pct > 0 ? `${Math.round(value)}%` : "—"}
        </div>
      </div>

      {/* textos laterais */}
      <div className="min-w-0">
        <p className="index-tag">{tag}</p>
        <p className="index-class" style={{ color: cl.textColor }}>
          {cl.label}
        </p>
        <p className="index-meta">{sublabel}</p>
      </div>
    </div>
  )
}
