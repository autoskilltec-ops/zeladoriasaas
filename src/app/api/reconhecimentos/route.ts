import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthUser, ok, err } from "@/lib/api/auth"

const schema = z.object({
  inspecao_id:     z.string().uuid(),
  nivel:           z.enum(["excelente", "bom_exemplo", "merece_reconhecimento"]),
  descricao:       z.string().max(500).optional().default(""),
  publicado_mural: z.boolean().optional().default(true),
})

export async function POST(request: NextRequest) {
  const { profile, supabase, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Sessão inválida", 401, "UNAUTHORIZED")

  let body: unknown
  try { body = await request.json() } catch { return err("JSON inválido", 400) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Dados inválidos", 400)

  const { inspecao_id, nivel, descricao, publicado_mural } = parsed.data

  const { data: inspecao } = await supabase
    .from("inspecoes")
    .select("id, status, zelador_id, inspetor_id")
    .eq("id", inspecao_id)
    .eq("organizacao_id", profile.organizacao_id)
    .single()

  if (!inspecao) return err("Inspeção não encontrada", 404, "NOT_FOUND")
  if (inspecao.status === "finalizada") return err("Inspeção já finalizada", 409)

  // UPSERT: uma inspeção tem no máximo um reconhecimento
  const { data: rec, error } = await supabase
    .from("reconhecimentos")
    .upsert(
      {
        inspecao_id,
        zelador_id:     inspecao.zelador_id,
        nivel,
        descricao:      descricao ?? "",
        publicado_mural: publicado_mural ?? true,
      },
      { onConflict: "inspecao_id" },
    )
    .select("id, nivel, publicado_mural")
    .single()

  if (error) return err("Erro ao salvar reconhecimento: " + error.message, 500, "DB_ERROR")

  return ok(rec, 201)
}

export async function GET(request: NextRequest) {
  const { profile, supabase, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Sessão inválida", 401, "UNAUTHORIZED")

  const { searchParams } = new URL(request.url)
  const nivel = searchParams.get("nivel")

  let query = supabase
    .from("reconhecimentos")
    .select(`
      id, nivel, descricao, publicado_mural, created_at,
      zelador:usuarios!zelador_id(id, nome, avatar_url),
      inspecoes!inner(local_id, data_inspecao, organizacao_id, locais(nome, bloco))
    `)
    .eq("publicado_mural", true)
    .filter("inspecoes.organizacao_id", "eq", profile.organizacao_id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (nivel) query = query.eq("nivel", nivel)

  const { data, error } = await query

  if (error) return err("Erro ao buscar reconhecimentos", 500, "DB_ERROR")

  return ok({ reconhecimentos: data ?? [] })
}
