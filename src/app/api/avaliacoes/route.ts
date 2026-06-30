import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthUser, ok, err } from "@/lib/api/auth"

const schema = z.object({
  inspecao_id: z.string().uuid(),
  avaliacoes: z
    .array(
      z.object({
        criterio_id: z.string().uuid(),
        nota:        z.number().int().min(1).max(5),
        observacao:  z.string().max(300).optional().default(""),
      }),
    )
    .min(0),
})

export async function POST(request: NextRequest) {
  const { profile, supabase, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Sessão inválida", 401, "UNAUTHORIZED")

  let body: unknown
  try { body = await request.json() } catch { return err("JSON inválido", 400) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Dados inválidos", 400)

  const { inspecao_id, avaliacoes } = parsed.data

  // Verifica que a inspeção pertence ao usuário e está em andamento
  const { data: inspecao } = await supabase
    .from("inspecoes")
    .select("id, status, inspetor_id")
    .eq("id", inspecao_id)
    .eq("organizacao_id", profile.organizacao_id)
    .single()

  if (!inspecao) return err("Inspeção não encontrada", 404, "NOT_FOUND")
  if (inspecao.status === "finalizada") return err("Inspeção já finalizada", 409, "ALREADY_FINALIZED")

  // Deleta avaliações anteriores e insere as novas (permite re-envio)
  if (avaliacoes.length > 0) {
    await supabase.from("avaliacoes_limpeza").delete().eq("inspecao_id", inspecao_id)

    const rows = avaliacoes.map((a) => ({
      inspecao_id,
      criterio_id: a.criterio_id,
      nota:        a.nota,
      observacao:  a.observacao ?? "",
    }))

    const { error } = await supabase.from("avaliacoes_limpeza").insert(rows)
    if (error) return err("Erro ao salvar avaliações: " + error.message, 500, "DB_ERROR")
  }

  return ok({ inspecao_id, total_avaliacoes: avaliacoes.length })
}
