import { NextRequest } from "next/server"
import { getAuthUser, ok, err } from "@/lib/api/auth"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const { profile, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Não autorizado", 401)
  if (!["admin", "gestor"].includes(profile.role)) return err("Sem permissão", 403)

  const sp     = req.nextUrl.searchParams
  const inicio = sp.get("inicio")
  const fim    = sp.get("fim")

  const supabase = await createClient()

  let query = supabase
    .from("nao_conformidades")
    .select(`
      id, tipo, descricao, criticidade, status, prazo_correcao, created_at,
      inspecoes!inner(locais(nome))
    `)
    .eq("organizacao_id", profile.organizacao_id)
    .order("created_at", { ascending: false })
    .limit(500)

  if (inicio) query = query.gte("created_at", `${inicio}T00:00:00`)
  if (fim)    query = query.lte("created_at", `${fim}T23:59:59`)

  const { data, error } = await query
  if (error) return err("Erro ao buscar NCs: " + error.message, 500)

  const ncs = (data ?? []).map((n: any) => ({
    id:             n.id,
    tipo:           n.tipo,
    descricao:      n.descricao,
    criticidade:    n.criticidade,
    status:         n.status,
    prazo_correcao: n.prazo_correcao,
    created_at:     n.created_at,
    local_nome:     n.inspecoes?.locais?.nome ?? "—",
  }))

  return ok({ ncs })
}
