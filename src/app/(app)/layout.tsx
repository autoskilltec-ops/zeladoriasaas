import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TopBar } from "@/components/layout/TopBar"
import { BottomNav } from "@/components/layout/BottomNav"
import { AppSidebar } from "@/components/layout/AppSidebar"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Middleware já redireciona, mas esta verificação serve como defesa em profundidade
  if (!user) redirect("/login")

  // Carrega pendências e perfil do usuário em paralelo
  const [pendingResult, profileResult] = await Promise.all([
    supabase
      .from("nao_conformidades")
      .select("id", { count: "exact", head: true })
      .eq("responsavel_id", user.id)
      .eq("status", "aberta"),
    supabase
      .from("usuarios")
      .select("nome, role")
      .eq("id", user.id)
      .single(),
  ])

  const pendingCount = pendingResult.count ?? 0
  const profile      = profileResult.data

  return (
    /*
     * Mobile  (< 900px): coluna única — TopBar fixa no topo, BottomNav fixo embaixo
     * Desktop (≥ 900px): linha — AppSidebar fixa à esquerda + coluna de conteúdo
     *                    TopBar e BottomNav ocultados via CSS no breakpoint 900px
     */
    <div className="flex flex-col min-[900px]:flex-row min-h-screen bg-[var(--bg)]">

      {/* Sidebar — oculta em mobile via CSS (.app-sidebar { display: none }) */}
      <AppSidebar
        pendingCount={pendingCount}
        userName={profile?.nome ?? user.email?.split("@")[0] ?? "Usuário"}
        userEmail={user.email ?? ""}
        userRole={profile?.role ?? "inspetor"}
      />

      {/* Coluna de conteúdo (sempre visível) */}
      <div className="flex flex-col flex-1 min-w-0 min-h-screen">

        {/* TopBar — oculta em desktop via CSS */}
        <TopBar />

        {/* Conteúdo principal */}
        <main className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] min-[900px]:pb-6">
          {children}
        </main>

        {/* BottomNav — oculta em desktop via CSS */}
        <BottomNav pendingCount={pendingCount} />
      </div>

    </div>
  )
}
