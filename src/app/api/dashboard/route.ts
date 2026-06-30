import { NextRequest } from "next/server"
import { getAuthUser, ok, err } from "@/lib/api/auth"

function getDateRange(periodo: string): { inicio: string; fim: string } {
  const now = new Date()
  const pad  = (n: number) => String(n).padStart(2, "0")
  const fmt  = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  switch (periodo) {
    case "hoje": {
      const s = fmt(now)
      return { inicio: s, fim: s }
    }
    case "semana": {
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay())
      return { inicio: fmt(start), fim: fmt(now) }
    }
    case "mes_anterior": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end   = new Date(now.getFullYear(), now.getMonth(), 0)
      return { inicio: fmt(start), fim: fmt(end) }
    }
    case "mes_atual":
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { inicio: fmt(start), fim: fmt(now) }
    }
  }
}

export async function GET(request: NextRequest) {
  const { profile, supabase, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Sessão inválida", 401, "UNAUTHORIZED")

  if (!["admin", "gestor"].includes(profile.role)) {
    return err("Sem permissão para acessar o dashboard", 403, "FORBIDDEN")
  }

  const { searchParams } = new URL(request.url)
  const periodo     = searchParams.get("periodo") ?? "mes_atual"
  const data_inicio = searchParams.get("data_inicio")
  const data_fim    = searchParams.get("data_fim")

  const range = (data_inicio && data_fim)
    ? { inicio: data_inicio, fim: data_fim }
    : getDateRange(periodo)

  const org = profile.organizacao_id

  // Busca inspecoes finalizadas no período
  const { data: inspecoes } = await supabase
    .from("inspecoes")
    .select("id, indice_qualidade, indice_seguranca, local_id, data_inspecao")
    .eq("organizacao_id", org)
    .eq("status", "finalizada")
    .gte("data_inspecao", range.inicio)
    .lte("data_inspecao", range.fim)

  const insp = inspecoes ?? []
  const total_inspecoes = insp.length

  const qualidade_media = total_inspecoes > 0
    ? insp.reduce((s, i) => s + (i.indice_qualidade ?? 0), 0) / total_inspecoes
    : 0

  const conformidade_epis = total_inspecoes > 0
    ? insp.reduce((s, i) => s + (i.indice_seguranca ?? 0), 0) / total_inspecoes
    : 0

  // NCs abertas
  const { data: ncsAbertas } = await supabase
    .from("nao_conformidades")
    .select("id, criticidade")
    .eq("organizacao_id", org)
    .eq("status", "aberta")

  const ncs = ncsAbertas ?? []
  const ncs_por_criticidade = {
    critico: ncs.filter((n) => n.criticidade === "critico").length,
    alto:    ncs.filter((n) => n.criticidade === "alto").length,
    medio:   ncs.filter((n) => n.criticidade === "medio").length,
    baixo:   ncs.filter((n) => n.criticidade === "baixo").length,
  }

  // Ranking de locais (média do IQL por local)
  const localMap: Record<string, { soma: number; count: number }> = {}
  for (const i of insp) {
    if (!localMap[i.local_id]) localMap[i.local_id] = { soma: 0, count: 0 }
    localMap[i.local_id].soma  += i.indice_qualidade ?? 0
    localMap[i.local_id].count += 1
  }

  const localIds = Object.keys(localMap)
  let ranking_locais: { local_id: string; nome: string; media_qualidade: number; total_inspecoes: number }[] = []

  if (localIds.length > 0) {
    const { data: locais } = await supabase
      .from("locais")
      .select("id, nome, bloco")
      .in("id", localIds)

    ranking_locais = (locais ?? [])
      .map((l) => ({
        local_id:        l.id,
        nome:            l.bloco ? `${l.nome} — ${l.bloco}` : l.nome,
        media_qualidade: Math.round((localMap[l.id].soma / localMap[l.id].count) * 10) / 10,
        total_inspecoes: localMap[l.id].count,
      }))
      .sort((a, b) => b.media_qualidade - a.media_qualidade)
      .slice(0, 10)
  }

  // Inspecoes por dia
  const dayMap: Record<string, number> = {}
  for (const i of insp) {
    dayMap[i.data_inspecao] = (dayMap[i.data_inspecao] ?? 0) + 1
  }
  const inspecoes_por_dia = Object.entries(dayMap)
    .map(([data, total]) => ({ data, total }))
    .sort((a, b) => a.data.localeCompare(b.data))

  return ok({
    periodo:            { inicio: range.inicio, fim: range.fim },
    qualidade_media:    Math.round(qualidade_media * 10) / 10,
    conformidade_epis:  Math.round(conformidade_epis * 10) / 10,
    total_ncs_abertas:  ncs.length,
    ncs_por_criticidade,
    ranking_locais,
    total_inspecoes,
    inspecoes_por_dia,
  })
}
