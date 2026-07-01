"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart2,
  Bell,
  ChevronRight,
  ClipboardCheck,
  LogOut,
  MoreHorizontal,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

// ─── Nav items (same order as BottomNav) ──────────────────────────────────────
const NAV_ITEMS = [
  { key: "dashboard",  label: "Dashboard",  href: "/dashboard",  icon: BarChart2 },
  { key: "inspecao",   label: "Inspeção",   href: "/inspecao",   icon: ClipboardCheck },
  { key: "pendencias", label: "Pendências", href: "/pendencias", icon: Bell, badge: true },
  { key: "mais",       label: "Mais",       href: "/mais",       icon: MoreHorizontal },
] as const

const ROLE_LABELS: Record<string, string> = {
  admin:    "Administrador",
  gestor:   "Gestor",
  inspetor: "Inspetor",
  zelador:  "Zelador",
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface AppSidebarProps {
  pendingCount: number
  userName:    string
  userEmail:   string
  userRole:    string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?"
}

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/inspecao") return pathname === "/inspecao"
  return pathname.startsWith(href)
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AppSidebar({
  pendingCount,
  userName,
  userEmail: _userEmail,
  userRole,
}: AppSidebarProps) {
  const pathname        = usePathname()
  const router          = useRouter()
  const supabase        = createClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const profileRef      = useRef<HTMLDivElement>(null)

  // Fecha o menu ao clicar fora
  useEffect(() => {
    if (!menuOpen) return
    function handleOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [menuOpen])

  // Fecha o menu no Escape
  useEffect(() => {
    if (!menuOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [menuOpen])

  async function handleLogout() {
    setMenuOpen(false)
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const initials = getInitials(userName)

  return (
    <aside className="app-sidebar" aria-label="Navegação lateral">

      {/* ── Marca ─────────────────────────────────────────────────────── */}
      <div className="app-sidebar-logo">
        <div className="app-sidebar-logo-icon" aria-hidden>
          <ClipboardCheck size={20} color="white" strokeWidth={1.8} />
        </div>
        <span className="app-sidebar-logo-text">Zeladoria</span>
      </div>

      {/* ── Navegação ─────────────────────────────────────────────────── */}
      <nav className="app-sidebar-nav" aria-label="Menu principal">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href)
          const count  = item.badge ? pendingCount : 0
          const Icon   = item.icon

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn("app-sidebar-nav-item", active && "active")}
              aria-current={active ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <span className="app-sidebar-nav-icon">
                <Icon
                  size={18}
                  strokeWidth={active ? 2.2 : 1.8}
                  aria-hidden
                />
                {count > 0 && (
                  <span
                    className="app-sidebar-nav-badge"
                    aria-label={`${count} pendências`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>

              <span>{item.label}</span>

              {count > 0 && (
                <span className="app-sidebar-pending-chip" aria-hidden>
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Espaço flexível ───────────────────────────────────────────── */}
      <div className="flex-1" aria-hidden />

      {/* ── Perfil do usuário ─────────────────────────────────────────── */}
      <div className="app-sidebar-profile" ref={profileRef}>

        {/* Dropdown de ações */}
        {menuOpen && (
          <div className="app-sidebar-profile-menu" role="menu">
            <button
              type="button"
              className="app-sidebar-menu-item"
              onClick={handleLogout}
              role="menuitem"
            >
              <LogOut size={14} aria-hidden />
              Sair da conta
            </button>
          </div>
        )}

        {/* Botão de perfil */}
        <button
          type="button"
          className="app-sidebar-profile-btn"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`Menu do usuário ${userName}`}
        >
          <div className="app-sidebar-avatar" aria-hidden>
            {initials}
          </div>

          <div className="app-sidebar-profile-info">
            <span className="app-sidebar-profile-name">{userName}</span>
            <span className="app-sidebar-profile-role">
              {ROLE_LABELS[userRole] ?? userRole}
            </span>
          </div>

          <ChevronRight
            size={14}
            className="app-sidebar-chevron"
            style={{ transform: menuOpen ? "rotate(90deg)" : undefined }}
            aria-hidden
          />
        </button>
      </div>

    </aside>
  )
}
