"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  User,
  Trophy,
  LogOut,
  ChevronRight,
  Settings,
  Shield,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface Profile {
  nome:    string
  email:   string
  role:    string
  organizacao_id: string
}

const ROLE_LABELS: Record<string, string> = {
  admin:    "Administrador",
  gestor:   "Gestor",
  inspetor: "Inspetor",
  zelador:  "Zelador",
}

interface MenuItem {
  label:       string
  description: string
  icon:        React.ElementType
  href:        string
  adminOnly?:  boolean
}

const MENU_ITEMS: MenuItem[] = [
  {
    label:       "Meu perfil",
    description: "Dados pessoais e senha",
    icon:        User,
    href:        "/mais/perfil",
  },
  {
    label:       "Mural dos Craques",
    description: "Reconhecimentos da equipe",
    icon:        Trophy,
    href:        "/mais/mural",
  },
  {
    label:       "Painel Administrativo",
    description: "Usuários, locais e configurações",
    icon:        Settings,
    href:        "/admin",
    adminOnly:   true,
  },
]

export default function MaisPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("usuarios")
        .select("nome, email, role, organizacao_id")
        .eq("id", user.id)
        .single()

      if (data) setProfile(data as Profile)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const isAdmin = profile?.role === "admin" || profile?.role === "gestor"

  return (
    <div className="px-4 pt-4 pb-2">

      {/* ── Card do usuário ───────────────────────────────────────────── */}
      <div className="card mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-[48px] h-[48px] rounded-full flex items-center justify-center shrink-0 text-[18px] font-medium text-white"
            style={{ background: "var(--green-700)" }}
          >
            {profile?.nome?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium text-[#1a2e22] truncate">
              {profile?.nome ?? "Carregando…"}
            </p>
            <p className="text-[12px] text-[#6b7280] truncate">{profile?.email}</p>
            {profile?.role && (
              <span
                className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: "var(--green-50)", color: "var(--green-700)", border: "1px solid var(--green-100)" }}
              >
                {ROLE_LABELS[profile.role] ?? profile.role}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Menu de navegação ─────────────────────────────────────────── */}
      <div className="card mb-3" style={{ padding: "4px 0" }}>
        {MENU_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item, idx, arr) => {
          const Icon = item.icon
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f8faf9]",
                idx < arr.length - 1 && "border-b border-[#f0f2f1]",
              )}
            >
              <div
                className="w-[36px] h-[36px] rounded-[9px] flex items-center justify-center shrink-0"
                style={{ background: "var(--green-50)", border: "1px solid var(--green-100)" }}
              >
                <Icon size={16} style={{ color: "var(--green-600)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#1a2e22]">{item.label}</p>
                <p className="text-[11px] text-[#9ca3af]">{item.description}</p>
              </div>
              <ChevronRight size={16} className="text-[#c4cdc7] shrink-0" />
            </button>
          )
        })}
      </div>

      {/* ── Logout ───────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleLogout}
        className="card w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#fef2f2]"
        style={{ padding: "14px 16px" }}
      >
        <div className="w-[36px] h-[36px] rounded-[9px] flex items-center justify-center shrink-0" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          <LogOut size={16} className="text-[#ef4444]" />
        </div>
        <span className="text-[13px] font-medium text-[#ef4444]">Sair da conta</span>
      </button>

      <p className="text-center text-[10px] text-[#c4cdc7] mt-4">
        Zeladoria v1.0
      </p>

    </div>
  )
}
