import { NextRequest } from "next/server"
import { getAuthUser, ok, err } from "@/lib/api/auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { profile, supabase, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Sessão inválida", 401, "UNAUTHORIZED")

  const { data, error } = await supabase
    .from("inspecoes")
    .select(`
      *,
      locais(id, nome, bloco, andar, descricao),
      inspetor:usuarios!inspetor_id(id, nome, email, role),
      zelador:usuarios!zelador_id(id, nome, email, role),
      avaliacoes_limpeza(criterio_id, nota, observacao),
      seguranca_checklist(item_id, conforme),
      epis_inspecao(status_geral, equipamentos_bons, observacoes),
      nao_conformidades(id, tipo, descricao, criticidade, acao_corretiva, prazo_correcao, status, responsavel_id),
      reconhecimentos(nivel, descricao, publicado_mural)
    `)
    .eq("id", id)
    .eq("organizacao_id", profile.organizacao_id)
    .single()

  if (error || !data) return err("Inspeção não encontrada", 404, "NOT_FOUND")

  return ok(data)
}
