import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TopBar } from "@/components/layout/TopBar"
import { BottomNav } from "@/components/layout/BottomNav"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Middleware já redireciona, mas esta verificação serve como defesa em profundidade
  if (!user) redirect("/login")

  // Conta pendências abertas do usuário para o badge do BottomNav
  const { count: pendingCount } = await supabase
    .from("nao_conformidades")
    .select("id", { count: "exact", head: true })
    .eq("responsavel_id", user.id)
    .eq("status", "aberta")

  return (
    /*
     * Mobile  (< lg): coluna única, TopBar fixa no topo, BottomNav fixo embaixo
     * Desktop (≥ lg): sidebar substituirá o BottomNav (implementar em fase futura)
     *                 max-w + centralização garantem legibilidade em telas largas
     */
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      {/* TopBar — sticky, lê rota via usePathname internamente */}
      <TopBar />

      {/* Área de conteúdo principal */}
      <main
        className={[
          "flex-1",
          // Mobile: padding inferior para não ficar atrás do BottomNav
          "pb-[calc(64px+env(safe-area-inset-bottom))]",
          // Desktop: sem padding inferior, conteúdo centralizado
          "lg:pb-6 lg:pt-4 lg:px-8 lg:max-w-5xl lg:mx-auto lg:w-full",
        ].join(" ")}
      >
        {children}
      </main>

      {/* BottomNav — oculto em lg+ via CSS (.bottom-nav { display:none } no breakpoint) */}
      <BottomNav pendingCount={pendingCount ?? 0} />
    </div>
  )
}
