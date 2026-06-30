import { NextRequest } from "next/server"
import { getAuthUser, ok, err } from "@/lib/api/auth"

const ALLOWED_TYPES  = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE_BYTES = 5 * 1024 * 1024  // 5 MB
const BUCKET         = "inspecoes-fotos"
const TIPOS_VALIDOS  = ["situacao", "corretiva", "final"] as const

export async function POST(request: NextRequest) {
  const { profile, supabase, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Sessão inválida", 401, "UNAUTHORIZED")

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return err("Requisição inválida: esperado multipart/form-data", 400)
  }

  const file       = formData.get("file") as File | null
  const inspecaoId = formData.get("inspecao_id") as string | null
  const tipo       = formData.get("tipo") as string | null

  if (!file || !inspecaoId || !tipo) {
    return err("Campos obrigatórios: file, inspecao_id, tipo", 400, "MISSING_FIELDS")
  }

  if (!TIPOS_VALIDOS.includes(tipo as typeof TIPOS_VALIDOS[number])) {
    return err("Tipo inválido. Use: situacao, corretiva ou final", 400)
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return err("Tipo de arquivo não permitido. Use JPG, PNG ou WebP.", 400, "INVALID_TYPE")
  }

  if (file.size > MAX_SIZE_BYTES) {
    return err("Arquivo muito grande. Máximo 5 MB.", 400, "FILE_TOO_LARGE")
  }

  // Verifica que a inspeção pertence ao usuário e não está finalizada
  const { data: inspecao } = await supabase
    .from("inspecoes")
    .select("id, status, organizacao_id")
    .eq("id", inspecaoId)
    .eq("organizacao_id", profile.organizacao_id)
    .single()

  if (!inspecao) return err("Inspeção não encontrada", 404, "NOT_FOUND")
  if (inspecao.status === "finalizada") return err("Inspeção já finalizada", 409)

  const ext       = file.type === "image/png" ? "png" : "jpg"
  const path      = `${profile.organizacao_id}/${inspecaoId}/${tipo}-${Date.now()}.${ext}`
  const buffer    = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return err("Erro ao enviar foto: " + uploadError.message, 500, "STORAGE_ERROR")
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  // Atualiza o campo correspondente na tabela inspecoes
  const fotoField = `foto_${tipo}_url` as
    | "foto_situacao_url"
    | "foto_corretiva_url"
    | "foto_final_url"

  await supabase
    .from("inspecoes")
    .update({ [fotoField]: publicUrl })
    .eq("id", inspecaoId)

  return ok({ url: publicUrl, path, tipo })
}
