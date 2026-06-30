import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import {
  LayoutDashboard,
  Users,
  MapPin,
  Building2,
  FileBarChart2,
  ChevronLeft,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/admin",              label: "Visão geral",   Icon: LayoutDashboard },
  { href: "/admin/usuarios",     label: "Usuários",      Icon: Users           },
  { href: "/admin/locais",       label: "Locais",        Icon: MapPin          },
  { href: "/admin/organizacao",  label: "Organização",   Icon: Building2       },
  { href: "/admin/relatorios",   label: "Relatórios",    Icon: FileBarChart2   },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("usuarios")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "gestor"].includes(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7f5]">
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 bg-white border-b border-[#e0e8e2] px-4 py-3 flex items-center gap-3"
      >
        <Link
          href="/dashboard"
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--green-700)] hover:bg-[var(--green-50)] transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft size={18} />
        </Link>
        <h1 className="text-[15px] font-semibold text-[#1a2e22]">Painel Administrativo</h1>
      </header>

      {/* ── Horizontal sub-nav ───────────────────────────────────────── */}
      <nav className="bg-white border-b border-[#e0e8e2] px-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-none py-1">
          {NAV_ITEMS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-medium text-[#6b7280] hover:text-[var(--green-700)] hover:bg-[var(--green-50)] transition-colors"
            >
              <Icon size={14} />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {/* ── Page content ─────────────────────────────────────────────── */}
      <main className="flex-1">{children}</main>
    </div>
  )
}
