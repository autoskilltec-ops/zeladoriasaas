import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthUser, ok, err, isUUID } from "@/lib/api/auth"
import { sanitizeText } from "@/lib/utils/sanitize"

const schema = z.object({
  inspecao_id:       z.string().uuid(),
  status_geral:      z.enum(["sim", "parcialmente", "nao"]),
  epis_ausentes:     z.array(z.string()).optional().default([]),
  equipamentos_bons: z.boolean(),
  observacoes:       z.string().max(500).optional().default(""),
})

export async function POST(request: NextRequest) {
  const { profile, supabase, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Sessão inválida", 401, "UNAUTHORIZED")

  let body: unknown
  try { body = await request.json() } catch { return err("JSON inválido", 400) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dados inválidos", 400)

  const { inspecao_id, status_geral, epis_ausentes, equipamentos_bons, observacoes } = parsed.data

  const { data: inspecao } = await supabase
    .from("inspecoes")
    .select("id, status")
    .eq("id", inspecao_id)
    .eq("organizacao_id", profile.organizacao_id)
    .single()

  if (!inspecao) return err("Inspeção não encontrada", 404, "NOT_FOUND")
  if (inspecao.status === "finalizada") return err("Inspeção já finalizada", 409)

  // UPSERT no registro principal de EPIs da inspeção
  const { data: episInspecao, error: upsertError } = await supabase
    .from("epis_inspecao")
    .upsert(
      { inspecao_id, status_geral, equipamentos_bons, observacoes: sanitizeText(observacoes ?? "") },
      { onConflict: "inspecao_id" },
    )
    .select("id")
    .single()

  if (upsertError) return err("Erro ao salvar EPIs: " + upsertError.message, 500, "DB_ERROR")

  // Recria os EPIs ausentes (apenas IDs UUID válidos)
  if (episInspecao) {
    await supabase.from("epis_ausentes").delete().eq("epi_inspecao_id", episInspecao.id)

    const uuidAusentes = (epis_ausentes ?? []).filter(isUUID)
    if (uuidAusentes.length > 0) {
      const rows = uuidAusentes.map((epi_id) => ({
        epi_inspecao_id: episInspecao.id,
        epi_id,
      }))
      await supabase.from("epis_ausentes").insert(rows)
    }
  }

  return ok({ inspecao_id, status_geral, epis_ausentes_salvos: (epis_ausentes ?? []).filter(isUUID).length })
}
