"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart2,
  ClipboardCheck,
  Bell,
  MoreHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  key:    string
  label:  string
  href:   string
  icon:   React.ElementType
  badge?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard",  label: "Dashboard",  href: "/dashboard",  icon: BarChart2 },
  { key: "inspecao",   label: "Inspeção",   href: "/inspecao",   icon: ClipboardCheck },
  { key: "pendencias", label: "Pendências", href: "/pendencias", icon: Bell, badge: true },
  { key: "mais",       label: "Mais",       href: "/mais",       icon: MoreHorizontal },
]

interface BottomNavProps {
  /** Número de pendências para exibir no badge. 0 = sem badge. */
  pendingCount?: number
}

export function BottomNav({ pendingCount = 0 }: BottomNavProps) {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav lg:hidden" aria-label="Navegação principal">
      {NAV_ITEMS.map((item) => {
        const isActive = isNavActive(pathname, item.href)
        const Icon = item.icon
        const count = item.badge ? pendingCount : 0

        return (
          <Link
            key={item.key}
            href={item.href}
            className="nav-item"
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="relative flex items-center justify-center">
              {/* Badge sage-100 por trás do ícone ativo */}
              {isActive && (
                <span
                  className="absolute -inset-x-2.5 -inset-y-1 rounded-[10px]"
                  style={{ background: "var(--sage-100)" }}
                  aria-hidden
                />
              )}
              <Icon
                size={22}
                strokeWidth={isActive ? 2.2 : 1.8}
                className={cn("nav-icon", isActive && "active")}
                aria-hidden
              />
              {count > 0 && (
                <span className="nav-badge" aria-label={`${count} pendências`}>
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </span>
            <span className={cn("nav-label", isActive && "active")}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

/** Marca como ativa a tab cujo href coincide com o início do pathname atual. */
function isNavActive(pathname: string, href: string): boolean {
  if (href === "/inspecao") {
    // Evita marcar /inspecao como ativo em sub-rotas (/inspecao/[id]/...)
    return pathname === "/inspecao"
  }
  return pathname.startsWith(href)
}
