import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthUser, ok, err } from "@/lib/api/auth"

const patchSchema = z.object({
  status:                 z.enum(["em_andamento", "resolvida", "cancelada"]),
  resolucao_descricao:    z.string().max(1000).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { profile, supabase, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Sessão inválida", 401, "UNAUTHORIZED")

  let body: unknown
  try { body = await request.json() } catch { return err("JSON inválido", 400) }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Dados inválidos", 400)

  const { status, resolucao_descricao } = parsed.data

  const { data: nc } = await supabase
    .from("nao_conformidades")
    .select("id, status, responsavel_id, organizacao_id")
    .eq("id", id)
    .eq("organizacao_id", profile.organizacao_id)
    .single()

  if (!nc) return err("Não conformidade não encontrada", 404, "NOT_FOUND")
  if (nc.status === "resolvida") return err("NC já está resolvida", 409, "ALREADY_RESOLVED")

  // Apenas admin, gestor ou o responsável podem atualizar
  const canUpdate =
    ["admin", "gestor"].includes(profile.role) || nc.responsavel_id === profile.id
  if (!canUpdate) return err("Sem permissão", 403, "FORBIDDEN")

  const updateData: Record<string, unknown> = { status }
  if (resolucao_descricao) updateData.resolucao_descricao = resolucao_descricao
  if (status === "resolvida") {
    updateData.resolvida_em  = new Date().toISOString()
    updateData.resolvida_por = profile.id
  }

  const { data: updated, error } = await supabase
    .from("nao_conformidades")
    .update(updateData)
    .eq("id", id)
    .select("id, status, updated_at")
    .single()

  if (error) return err("Erro ao atualizar NC: " + error.message, 500, "DB_ERROR")

  return ok(updated)
}
