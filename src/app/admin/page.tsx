import { createClient } from "@/lib/supabase/server"
import { Users, MapPin, AlertTriangle, ClipboardList } from "lucide-react"

async function getStats(organizacao_id: string) {
  const supabase = await createClient()

  const [usuariosRes, locaisRes, ncsRes, inspecoesRes] = await Promise.all([
    supabase.from("usuarios").select("id", { count: "exact", head: true }).eq("organizacao_id", organizacao_id),
    supabase.from("locais").select("id", { count: "exact", head: true }).eq("organizacao_id", organizacao_id),
    supabase.from("nao_conformidades").select("id", { count: "exact", head: true })
      .eq("organizacao_id", organizacao_id).eq("status", "aberta"),
    supabase.from("inspecoes").select("id", { count: "exact", head: true })
      .eq("organizacao_id", organizacao_id).eq("status", "finalizada"),
  ])

  return {
    usuarios:          usuariosRes.count ?? 0,
    locais:            locaisRes.count ?? 0,
    ncs_abertas:       ncsRes.count ?? 0,
    total_inspecoes:   inspecoesRes.count ?? 0,
  }
}

async function getRecentInspecoes(organizacao_id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("inspecoes")
    .select("id, data_inspecao, status, indice_qualidade, usuarios!inspetor_id(nome), locais(nome)")
    .eq("organizacao_id", organizacao_id)
    .order("created_at", { ascending: false })
    .limit(5)

  return data ?? []
}

const STATUS_LABELS: Record<string, string> = {
  em_andamento: "Em andamento",
  finalizada:   "Finalizada",
  rascunho:     "Rascunho",
}

const STATUS_COLOR: Record<string, string> = {
  em_andamento: "#f59e0b",
  finalizada:   "#3dbf65",
  rascunho:     "#9ca3af",
}

function formatDate(iso: string) {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from("usuarios").select("organizacao_id").eq("id", user!.id).single()
  const org_id = profile!.organizacao_id

  const [stats, recentes] = await Promise.all([
    getStats(org_id),
    getRecentInspecoes(org_id),
  ])

  return (
    <div className="px-4 pt-4 pb-6 max-w-2xl mx-auto">

      {/* ── Cards de métricas ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: "Usuários",       value: stats.usuarios,        Icon: Users,          color: "#2563eb" },
          { label: "Locais",         value: stats.locais,          Icon: MapPin,         color: "var(--green-600)" },
          { label: "NCs abertas",    value: stats.ncs_abertas,     Icon: AlertTriangle,  color: "#ef4444" },
          { label: "Inspeções",      value: stats.total_inspecoes, Icon: ClipboardList,  color: "#7c3aed" },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="card flex items-center gap-3">
            <div className="w-[40px] h-[40px] rounded-[10px] flex items-center justify-center shrink-0"
              style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <p className="text-[22px] font-semibold text-[#1a2e22] leading-none">{value}</p>
              <p className="text-[11px] text-[#9ca3af] mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Inspeções recentes ────────────────────────────────────────── */}
      <div className="card">
        <p className="card-title">Inspeções recentes</p>

        {recentes.length === 0 ? (
          <p className="text-[13px] text-[#9ca3af] py-2 text-center">Nenhuma inspeção registrada</p>
        ) : (
          <div className="space-y-2">
            {recentes.map((insp: any) => (
              <div key={insp.id} className="flex items-center gap-3 py-1.5 border-b border-[#f0f2f1] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1a2e22] truncate">
                    {insp.locais?.nome ?? "—"}
                  </p>
                  <p className="text-[11px] text-[#9ca3af]">
                    {formatDate(insp.data_inspecao)} · {(insp.usuarios as any)?.nome ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {insp.indice_qualidade != null && (
                    <span className="text-[12px] font-medium text-[var(--green-700)]">
                      {Number(insp.indice_qualidade).toFixed(0)}%
                    </span>
                  )}
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: `${STATUS_COLOR[insp.status]}18`,
                      color: STATUS_COLOR[insp.status],
                    }}
                  >
                    {STATUS_LABELS[insp.status] ?? insp.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
