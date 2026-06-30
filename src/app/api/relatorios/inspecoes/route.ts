import { NextRequest } from "next/server"
import { getAuthUser, ok, err } from "@/lib/api/auth"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const { user, profile, error: authErr } = await getAuthUser()
  if (authErr || !user || !profile) return err("Não autorizado", 401)
  if (!["admin", "gestor"].includes(profile.role)) return err("Sem permissão", 403)

  const sp    = req.nextUrl.searchParams
  const inicio = sp.get("inicio")
  const fim    = sp.get("fim")

  const supabase = await createClient()

  let query = supabase
    .from("inspecoes")
    .select(`
      id, data_inspecao, status, indice_qualidade, indice_seguranca,
      locais(nome),
      usuarios!inspetor_id(nome)
    `)
    .eq("organizacao_id", profile.organizacao_id)
    .order("data_inspecao", { ascending: false })
    .limit(200)

  if (inicio) query = query.gte("data_inspecao", inicio)
  if (fim)    query = query.lte("data_inspecao", fim)

  const { data, error } = await query
  if (error) return err("Erro ao buscar inspeções: " + error.message, 500)

  const inspecoes = (data ?? []).map((i: any) => ({
    id:            i.id,
    data_inspecao: i.data_inspecao,
    status:        i.status,
    iql:           i.indice_qualidade,
    cs:            i.indice_seguranca,
    local_nome:    i.locais?.nome ?? "—",
    inspetor_nome: i.usuarios?.nome ?? "—",
  }))

  return Response.json(ok({ inspecoes }))
}
