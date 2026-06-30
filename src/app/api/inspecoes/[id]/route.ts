import { NextRequest } from "next/server"
import { getAuthUser, ok, err } from "@/lib/api/auth"

const BUCKET          = "inspecoes-fotos"
const SIGNED_URL_TTL  = 3600 // 1 hora

const FOTO_FIELDS = [
  "foto_situacao_url",
  "foto_corretiva_url",
  "foto_final_url",
] as const

/** Converte paths do Storage em signed URLs. Se o valor já for uma URL http, mantém. */
async function resolvePhotoUrls(
  data: Record<string, unknown>,
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
): Promise<Record<string, unknown>> {
  const result = { ...data }

  for (const field of FOTO_FIELDS) {
    const value = result[field]
    if (typeof value !== "string" || value.startsWith("http")) continue

    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(value, SIGNED_URL_TTL)

    result[field] = signed?.signedUrl ?? null
  }

  return result
}

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

  // Converte paths de foto em signed URLs antes de retornar
  const resolved = await resolvePhotoUrls(data as Record<string, unknown>, supabase)

  return ok(resolved)
}
