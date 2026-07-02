import { NextRequest } from "next/server"
import crypto from "crypto"
import { getAuthUser, ok, err } from "@/lib/api/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { auditLog } from "@/lib/audit"

// Usado quando o admin cadastra um responsável informando apenas o nome:
// a conta de login precisa existir (FK usuarios -> auth.users), mas as
// credenciais são geradas internamente e nunca usadas para acessar o sistema.
function slugify(nome: string): string {
  const slug = nome
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
  return slug || "responsavel"
}

function generatePlaceholderEmail(nome: string): string {
  return `${slugify(nome)}.${crypto.randomBytes(4).toString("hex")}@sem-login.zeladoriasaas.app`
}

function generateRandomPassword(): string {
  return `${crypto.randomBytes(16).toString("base64url")}Aa1`
}

export async function POST(req: NextRequest) {
  const { profile, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Não autorizado", 401)
  if (!["admin", "gestor"].includes(profile.role)) return err("Sem permissão", 403)

  const body = await req.json()
  const { nome, role } = body ?? {}
  let { email, senha } = body ?? {}

  if (!nome?.trim() || !role) {
    return err("Campos obrigatórios ausentes", 400)
  }
  if (!["admin", "gestor", "inspetor", "zelador"].includes(role)) {
    return err("Perfil inválido", 400)
  }
  if (senha && (senha.length < 8 || !/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha))) {
    return err("Senha deve ter ao menos 8 caracteres com letras e números", 400)
  }

  email = email?.trim() || generatePlaceholderEmail(nome)
  senha = senha || generateRandomPassword()

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email:          email.trim(),
    password:       senha,
    email_confirm:  true,
  })

  if (authError || !authData.user) {
    return err(authError?.message ?? "Erro ao criar usuário no auth", 500)
  }

  const { data: usuario, error: dbError } = await supabaseAdmin
    .from("usuarios")
    .insert({
      id:              authData.user.id,
      nome:            nome.trim(),
      email:           email.trim().toLowerCase(),
      role,
      organizacao_id:  profile.organizacao_id,
      ativo:           true,
    })
    .select("id, nome, email, role, ativo, created_at")
    .single()

  if (dbError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return err("Erro ao salvar usuário: " + dbError.message, 500)
  }

  await auditLog({
    user_id:        profile.id,
    organizacao_id: profile.organizacao_id,
    action:         "usuario.criar",
    resource_id:    authData.user.id,
    request:        req,
    metadata:       { email: email.trim(), role },
  })

  return ok({ usuario }, 201)
}
