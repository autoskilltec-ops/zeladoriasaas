import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthUser, ok, err, isUUID } from "@/lib/api/auth"

const schema = z.object({
  inspecao_id: z.string().uuid(),
  respostas: z.array(
    z.object({
      item_id:  z.string().min(1),
      conforme: z.boolean(),
    }),
  ),
})

export async function POST(request: NextRequest) {
  const { profile, supabase, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Sessão inválida", 401, "UNAUTHORIZED")

  let body: unknown
  try { body = await request.json() } catch { return err("JSON inválido", 400) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Dados inválidos", 400)

  const { inspecao_id, respostas } = parsed.data

  const { data: inspecao } = await supabase
    .from("inspecoes")
    .select("id, status")
    .eq("id", inspecao_id)
    .eq("organizacao_id", profile.organizacao_id)
    .single()

  if (!inspecao) return err("Inspeção não encontrada", 404, "NOT_FOUND")
  if (inspecao.status === "finalizada") return err("Inspeção já finalizada", 409)

  // Apenas item_ids que são UUIDs válidos podem ser inseridos (os padrões hardcoded são strings simples)
  const uuidRespostas = respostas.filter((r) => isUUID(r.item_id))

  if (uuidRespostas.length > 0) {
    await supabase.from("seguranca_checklist").delete().eq("inspecao_id", inspecao_id)

    const rows = uuidRespostas.map((r) => ({
      inspecao_id,
      item_id:  r.item_id,
      conforme: r.conforme,
    }))

    const { error } = await supabase.from("seguranca_checklist").insert(rows)
    if (error) return err("Erro ao salvar checklist: " + error.message, 500, "DB_ERROR")
  }

  return ok({
    inspecao_id,
    total_itens:    respostas.length,
    total_salvos:   uuidRespostas.length,
    total_conformes: respostas.filter((r) => r.conforme).length,
  })
}
