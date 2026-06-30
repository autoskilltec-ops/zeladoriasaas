import { NextRequest } from "next/server"
import { getAuthUser, ok, err } from "@/lib/api/auth"
import { auditLog } from "@/lib/audit"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { profile, supabase, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Sessão inválida", 401, "UNAUTHORIZED")

  const { data: inspecao, error: fetchError } = await supabase
    .from("inspecoes")
    .select("id, status, inspetor_id, organizacao_id")
    .eq("id", id)
    .eq("organizacao_id", profile.organizacao_id)
    .single()

  if (fetchError || !inspecao) return err("Inspeção não encontrada", 404, "NOT_FOUND")
  if (inspecao.status === "finalizada") return err("Inspeção já foi finalizada", 409, "ALREADY_FINALIZED")

  if (inspecao.inspetor_id !== profile.id && profile.role !== "admin") {
    return err("Sem permissão para finalizar esta inspeção", 403, "FORBIDDEN")
  }

  const { error: rpcError } = await supabase.rpc("calcular_indices_inspecao", {
    p_inspecao_id: id,
  })

  if (rpcError) {
    const { error: updateError } = await supabase
      .from("inspecoes")
      .update({ status: "finalizada", finalizada_em: new Date().toISOString() })
      .eq("id", id)

    if (updateError) return err("Erro ao finalizar inspeção: " + updateError.message, 500, "DB_ERROR")
  }

  const { data: finalizada } = await supabase
    .from("inspecoes")
    .select("id, status, indice_qualidade, indice_seguranca, finalizada_em")
    .eq("id", id)
    .single()

  await auditLog({
    user_id:        profile.id,
    organizacao_id: profile.organizacao_id,
    action:         "inspecao.finalizar",
    resource_id:    id,
    request,
    metadata:       {
      indice_qualidade: finalizada?.indice_qualidade,
      indice_seguranca: finalizada?.indice_seguranca,
    },
  })

  return ok({
    inspecao_id:      id,
    status:           "finalizada",
    indice_qualidade: finalizada?.indice_qualidade ?? null,
    indice_seguranca: finalizada?.indice_seguranca ?? null,
    finalizada_em:    finalizada?.finalizada_em ?? new Date().toISOString(),
  })
}
