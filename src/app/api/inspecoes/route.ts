import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthUser, ok, err } from "@/lib/api/auth"
import { sanitizeText } from "@/lib/utils/sanitize"
import { auditLog } from "@/lib/audit"

const createSchema = z.object({
  local_id:           z.string().uuid("local_id inválido"),
  zelador_id:         z.string().uuid("zelador_id inválido"),
  data_inspecao:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido"),
  descricao_visita:   z.string().max(500).optional().default(""),
  limpeza_programada: z.enum(["sim", "nao"]),
  // inspetor_id do body é ignorado — usamos auth.uid()
  inspetor_id:        z.string().optional(),
})

export async function POST(request: NextRequest) {
  const { profile, supabase, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Sessão inválida", 401, "UNAUTHORIZED")

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return err("Corpo da requisição inválido", 400, "INVALID_JSON")
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos"
    return err(message, 400, "VALIDATION_ERROR")
  }

  const { local_id, zelador_id, data_inspecao, limpeza_programada } = parsed.data
  const descricao_visita = sanitizeText(parsed.data.descricao_visita ?? "")

  // Verifica que o local pertence à organização do usuário
  const { data: local } = await supabase
    .from("locais")
    .select("id")
    .eq("id", local_id)
    .eq("organizacao_id", profile.organizacao_id)
    .eq("ativo", true)
    .single()

  if (!local) return err("Local não encontrado ou inativo", 404, "LOCAL_NOT_FOUND")

  // Insere a inspeção
  const { data: inspecao, error: insertError } = await supabase
    .from("inspecoes")
    .insert({
      organizacao_id:     profile.organizacao_id,
      local_id,
      inspetor_id:        profile.id,          // sempre do token
      zelador_id,
      data_inspecao,
      descricao_visita:   descricao_visita ?? "",
      limpeza_programada,
      status:             "em_andamento",
    })
    .select("id")
    .single()

  if (insertError) {
    return err("Erro ao criar inspeção: " + insertError.message, 500, "DB_ERROR")
  }

  await auditLog({
    user_id:        profile.id,
    organizacao_id: profile.organizacao_id,
    action:         "inspecao.criar",
    resource_id:    inspecao.id,
    request,
    metadata:       { local_id, data_inspecao },
  })

  return ok({ inspecao_id: inspecao.id }, 201)
}

export async function GET(request: NextRequest) {
  const { profile, supabase, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Sessão inválida", 401, "UNAUTHORIZED")

  const { searchParams } = new URL(request.url)
  const status    = searchParams.get("status")
  const local_id  = searchParams.get("local_id")
  const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit     = Math.min(50, parseInt(searchParams.get("limit") ?? "20"))
  const offset    = (page - 1) * limit

  let query = supabase
    .from("inspecoes")
    .select(`
      id, data_inspecao, status, limpeza_programada,
      indice_qualidade, indice_seguranca, created_at,
      locais(nome, bloco, andar),
      inspetor:usuarios!inspetor_id(nome),
      zelador:usuarios!zelador_id(nome)
    `, { count: "exact" })
    .eq("organizacao_id", profile.organizacao_id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq("status", status)
  if (local_id) query = query.eq("local_id", local_id)

  const { data, error, count } = await query

  if (error) return err("Erro ao buscar inspeções", 500, "DB_ERROR")

  return ok({ inspecoes: data ?? [], total: count ?? 0, page, limit })
}
