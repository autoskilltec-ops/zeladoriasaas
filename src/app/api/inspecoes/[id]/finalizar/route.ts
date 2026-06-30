import { NextRequest } from "next/server"
import { getAuthUser, ok, err } from "@/lib/api/auth"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { profile, supabase, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Sessão inválida", 401, "UNAUTHORIZED")

  // Verifica que a inspeção pertence ao usuário e está em andamento
  const { data: inspecao, error: fetchError } = await supabase
    .from("inspecoes")
    .select("id, status, inspetor_id, organizacao_id")
    .eq("id", id)
    .eq("organizacao_id", profile.organizacao_id)
    .single()

  if (fetchError || !inspecao) {
    return err("Inspeção não encontrada", 404, "NOT_FOUND")
  }

  if (inspecao.status === "finalizada") {
    return err("Inspeção já foi finalizada", 409, "ALREADY_FINALIZED")
  }

  // Apenas o inspetor ou admin pode finalizar
  if (inspecao.inspetor_id !== profile.id && profile.role !== "admin") {
    return err("Sem permissão para finalizar esta inspeção", 403, "FORBIDDEN")
  }

  // Chama a função do banco que calcula índices e muda status para 'finalizada'
  const { error: rpcError } = await supabase.rpc("calcular_indices_inspecao", {
    p_inspecao_id: id,
  })

  if (rpcError) {
    // Fallback: tenta finalizar diretamente sem calcular índices (caso a função não exista)
    const { error: updateError } = await supabase
      .from("inspecoes")
      .update({ status: "finalizada", finalizada_em: new Date().toISOString() })
      .eq("id", id)

    if (updateError) {
      return err("Erro ao finalizar inspeção: " + updateError.message, 500, "DB_ERROR")
    }
  }

  // Busca os índices calculados para retornar no resumo
  const { data: finalizada } = await supabase
    .from("inspecoes")
    .select("id, status, indice_qualidade, indice_seguranca, finalizada_em")
    .eq("id", id)
    .single()

  return ok({
    inspecao_id:      id,
    status:           "finalizada",
    indice_qualidade: finalizada?.indice_qualidade ?? null,
    indice_seguranca: finalizada?.indice_seguranca ?? null,
    finalizada_em:    finalizada?.finalizada_em ?? new Date().toISOString(),
  })
}
