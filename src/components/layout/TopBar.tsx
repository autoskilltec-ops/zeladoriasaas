"use client"

import { usePathname, useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

// Título derivado automaticamente da rota quando nenhum é passado via prop
const ROUTE_TITLES: Record<string, string> = {
  "/inspecao":                       "Nova Inspeção",
  "/pendencias":                     "Pendências",
  "/dashboard":                      "Dashboard",
  "/mais":                           "Mais",
  "/mais/mural":                     "Mural dos Craques",
  "/admin":                          "Administração",
  "/admin/usuarios":                 "Usuários",
  "/admin/locais":                   "Locais",
  "/admin/organizacao":              "Organização",
  "/admin/relatorios":               "Relatórios",
}

function resolveTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]

  // Rotas dinâmicas dos steps de inspeção: /inspecao/[id]/avaliacao etc.
  if (pathname.includes("/avaliacao"))         return "Avaliação de Limpeza"
  if (pathname.includes("/seguranca"))         return "Segurança"
  if (pathname.includes("/epis"))              return "EPIs"
  if (pathname.includes("/nao-conformidades")) return "Não Conformidades"
  if (pathname.includes("/reconhecimento"))    return "Reconhecimento"
  if (pathname.includes("/resumo"))            return "Resumo"

  return "Zeladoria"
}

interface TopBarProps {
  /** Título exibido. Quando omitido, deriva automaticamente da rota atual. */
  title?: string
  showBack?: boolean
  onBack?: () => void
  rightAction?: React.ReactNode
  className?: string
}

export function TopBar({ title, showBack, onBack, rightAction, className }: TopBarProps) {
  const pathname = usePathname()
  const router   = useRouter()

  const resolvedTitle   = title ?? resolveTitle(pathname)
  const shouldShowBack  = showBack ?? isStepRoute(pathname)

  function handleBack() {
    if (onBack) { onBack(); return }
    router.back()
  }

  return (
    <header className={cn("topbar", className)}>
      {/* Botão Voltar */}
      {shouldShowBack ? (
        <button
          type="button"
          onClick={handleBack}
          className="topbar-icon-btn"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} color="white" strokeWidth={2.5} />
        </button>
      ) : (
        /* Espaço reservado para manter o título centralizado */
        <div className="w-[32px] min-w-[44px]" aria-hidden />
      )}

      {/* Título */}
      <h1 className="flex-1 text-center text-[15px] font-medium text-white leading-none truncate">
        {resolvedTitle}
      </h1>

      {/* Ação direita (ex: botão de salvar, ícone de ajuda) */}
      {rightAction ? (
        <div className="flex items-center">{rightAction}</div>
      ) : (
        <div className="w-[32px] min-w-[44px]" aria-hidden />
      )}
    </header>
  )
}

/** Rotas de steps têm botão voltar por padrão */
function isStepRoute(pathname: string): boolean {
  return (
    pathname.includes("/avaliacao") ||
    pathname.includes("/seguranca") ||
    pathname.includes("/epis") ||
    pathname.includes("/nao-conformidades") ||
    pathname.includes("/reconhecimento") ||
    pathname.includes("/resumo")
  )
}
