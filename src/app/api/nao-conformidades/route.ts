import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthUser, ok, err } from "@/lib/api/auth"

const ncSchema = z.object({
  tipo:           z.enum(["seguranca", "limpeza", "epi", "estrutural", "outro"]),
  descricao:      z.string().min(3, "Descrição muito curta").max(1000),
  criticidade:    z.enum(["critico", "alto", "medio", "baixo"]),
  acao_corretiva: z.string().min(3, "Ação corretiva muito curta").max(1000),
  prazo_correcao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido"),
  responsavel_id: z.string().uuid("responsavel_id inválido"),
})

const bodySchema = z.object({
  inspecao_id:       z.string().uuid(),
  nao_conformidades: z.array(ncSchema).min(1, "Inclua ao menos uma não conformidade"),
})

export async function POST(request: NextRequest) {
  const { profile, supabase, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Sessão inválida", 401, "UNAUTHORIZED")

  let body: unknown
  try { body = await request.json() } catch { return err("JSON inválido", 400) }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Dados inválidos", 400)

  const { inspecao_id, nao_conformidades } = parsed.data

  const { data: inspecao } = await supabase
    .from("inspecoes")
    .select("id, status")
    .eq("id", inspecao_id)
    .eq("organizacao_id", profile.organizacao_id)
    .single()

  if (!inspecao) return err("Inspeção não encontrada", 404, "NOT_FOUND")
  if (inspecao.status === "finalizada") return err("Inspeção já finalizada", 409)

  const rows = nao_conformidades.map((nc) => ({
    inspecao_id,
    organizacao_id: profile.organizacao_id,
    tipo:           nc.tipo,
    descricao:      nc.descricao,
    criticidade:    nc.criticidade,
    acao_corretiva: nc.acao_corretiva,
    prazo_correcao: nc.prazo_correcao,
    responsavel_id: nc.responsavel_id,
    status:         "aberta" as const,
  }))

  const { data: inserted, error } = await supabase
    .from("nao_conformidades")
    .insert(rows)
    .select("id, tipo, criticidade, prazo_correcao")

  if (error) return err("Erro ao salvar não conformidades: " + error.message, 500, "DB_ERROR")

  return ok({ inspecao_id, nao_conformidades: inserted, total: inserted?.length ?? 0 }, 201)
}

export async function GET(request: NextRequest) {
  const { profile, supabase, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Sessão inválida", 401, "UNAUTHORIZED")

  const { searchParams } = new URL(request.url)
  const status      = searchParams.get("status") ?? "aberta"
  const inspecao_id = searchParams.get("inspecao_id")

  let query = supabase
    .from("nao_conformidades")
    .select(`
      id, tipo, descricao, criticidade, acao_corretiva,
      prazo_correcao, status, created_at, updated_at,
      responsavel:usuarios!responsavel_id(nome),
      inspecoes!inner(local_id, data_inspecao, locais(nome, bloco))
    `)
    .eq("organizacao_id", profile.organizacao_id)
    .order("criticidade", { ascending: false })
    .order("prazo_correcao", { ascending: true })

  if (status) query = query.eq("status", status)
  if (inspecao_id) query = query.eq("inspecao_id", inspecao_id)

  const { data, error } = await query

  if (error) return err("Erro ao buscar não conformidades", 500, "DB_ERROR")

  return ok({ nao_conformidades: data ?? [] })
}
