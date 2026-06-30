import { NextRequest, NextResponse } from "next/server"
import { getAuthUser, ok, err } from "@/lib/api/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { auditLog } from "@/lib/audit"

export async function POST(req: NextRequest) {
  const { profile, unauthorized } = await getAuthUser()
  if (unauthorized || !profile) return err("Não autorizado", 401)
  if (!["admin", "gestor"].includes(profile.role)) return err("Sem permissão", 403)

  const body = await req.json()
  const { nome, email, senha, role } = body ?? {}

  if (!nome?.trim() || !email?.trim() || !senha || !role) {
    return err("Campos obrigatórios ausentes", 400)
  }
  if (senha.length < 6) return err("Senha mínima: 6 caracteres", 400)
  if (!["admin", "gestor", "inspetor", "zelador"].includes(role)) {
    return err("Perfil inválido", 400)
  }

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
