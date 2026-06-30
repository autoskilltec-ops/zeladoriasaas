import { NextRequest } from "next/server"
import { getAuthUser, ok, err } from "@/lib/api/auth"

const ALLOWED_TYPES  = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE_BYTES = 5 * 1024 * 1024  // 5 MB
const BUCKET         = "inspecoes-fotos"
const TIPOS_VALIDOS  = ["situacao", "corretiva", "final"] as const

// ─── Magic bytes ──────────────────────────────────────────────────────────────
// Valida o conteúdo real do arquivo, não apenas o MIME declarado pelo cliente.
function validateMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  const b = bytes

  const isJpeg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF
  const isPng  = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47
  // WebP: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP"
  const isWebp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
               && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50

  if (mimeType === "image/jpeg") return isJpeg
  if (mimeType === "image/png")  return isPng
  if (mimeType === "image/webp") return isWebp
  return false
}

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

  // 1. Validação de MIME type declarado
  if (!ALLOWED_TYPES.includes(file.type)) {
    return err("Tipo de arquivo não permitido. Use JPG, PNG ou WebP.", 400, "INVALID_TYPE")
  }

  // 2. Validação de tamanho
  if (file.size > MAX_SIZE_BYTES) {
    return err("Arquivo muito grande. Máximo 5 MB.", 400, "FILE_TOO_LARGE")
  }

  // 3. Lê os bytes e valida magic bytes (conteúdo real do arquivo)
  const buffer = new Uint8Array(await file.arrayBuffer())

  if (!validateMagicBytes(buffer, file.type)) {
    return err("Conteúdo do arquivo não corresponde ao tipo declarado.", 400, "INVALID_FILE_CONTENT")
  }

  // 4. Verifica que a inspeção pertence ao usuário e está em andamento
  const { data: inspecao } = await supabase
    .from("inspecoes")
    .select("id, status, organizacao_id")
    .eq("id", inspecaoId)
    .eq("organizacao_id", profile.organizacao_id)
    .single()

  if (!inspecao) return err("Inspeção não encontrada", 404, "NOT_FOUND")
  if (inspecao.status === "finalizada") return err("Inspeção já finalizada", 409)

  // 5. Path seguro gerado no servidor (nunca pelo cliente)
  const ext  = file.type === "image/png" ? "png" : "jpg"
  const path = `${profile.organizacao_id}/${inspecaoId}/${tipo}-${Date.now()}.${ext}`

  // 6. Upload para bucket privado
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return err("Erro ao enviar foto: " + uploadError.message, 500, "STORAGE_ERROR")
  }

  // 7. Persiste o PATH (não a URL) — URL é gerada sob demanda via signed URL
  const fotoField = `foto_${tipo}_url` as
    | "foto_situacao_url"
    | "foto_corretiva_url"
    | "foto_final_url"

  await supabase
    .from("inspecoes")
    .update({ [fotoField]: path })
    .eq("id", inspecaoId)

  // 8. Signed URL de curta duração para exibição imediata (1 hora)
  const { data: signedData } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600)

  return ok({ url: signedData?.signedUrl ?? null, path, tipo })
}
