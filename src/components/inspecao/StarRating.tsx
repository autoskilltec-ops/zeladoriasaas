"use client"

import { Star } from "lucide-react"

interface StarRatingProps {
  /** 0 = não avaliado, 1–5 = nota */
  value:     number
  onChange?: (v: number) => void
  /** impede interação */
  readonly?: boolean
}

export function StarRating({ value, onChange, readonly = false }: StarRatingProps) {
  return (
    <div
      className="stars"
      role="radiogroup"
      aria-label="Avaliação de 1 a 5 estrelas"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value
        return (
          <button
            key={star}
            type="button"
            className="star-btn"
            onClick={() => {
              if (readonly || !onChange) return
              // clicar na estrela já selecionada deseleciona (volta a 0)
              onChange(star === value ? 0 : star)
            }}
            aria-label={`${star} estrela${star !== 1 ? "s" : ""}`}
            aria-pressed={filled}
            disabled={readonly}
          >
            <Star
              size={20}
              className="star-icon"
              fill={filled ? "#f5a623" : "none"}
              color={filled ? "#f5a623" : "#e5e7eb"}
              strokeWidth={filled ? 0 : 1.5}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
}
