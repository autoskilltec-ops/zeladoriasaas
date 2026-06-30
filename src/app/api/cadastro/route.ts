import { NextRequest } from "next/server"
import { z } from "zod"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

const schema = z.object({
  org_nome:      z.string().min(2, "Nome da organização muito curto").max(100),
  usuario_nome:  z.string().min(2, "Nome muito curto").max(100),
  email:         z.string().email("E-mail inválido"),
  password:      z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
}

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ data: null, error: { code: "INVALID_JSON", message: "JSON inválido" } }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "Dados inválidos"
    return NextResponse.json({ data: null, error: { code: "VALIDATION", message } }, { status: 400 })
  }

  const { org_nome, usuario_nome, email, password } = parsed.data
  const slug = slugify(org_nome)

  // 1. Cria a organização
  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizacoes")
    .insert({ nome: org_nome, slug })
    .select("id")
    .single()

  if (orgError) {
    const isDuplicate = orgError.code === "23505"
    return NextResponse.json(
      { data: null, error: { code: "ORG_ERROR", message: isDuplicate ? "Organização com este nome já existe" : orgError.message } },
      { status: isDuplicate ? 409 : 500 },
    )
  }

  // 2. Cria o usuário no Supabase Auth
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,      // confirma automaticamente (sem email)
  })

  if (authError || !authUser?.user) {
    // Rollback: remove a organização
    await supabaseAdmin.from("organizacoes").delete().eq("id", org.id)
    const isDuplicate = authError?.message?.includes("already registered")
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: isDuplicate ? "E-mail já cadastrado" : (authError?.message ?? "Erro ao criar usuário") } },
      { status: isDuplicate ? 409 : 500 },
    )
  }

  // 3. Cria o perfil na tabela usuarios como admin
  const { error: userError } = await supabaseAdmin
    .from("usuarios")
    .insert({
      id:             authUser.user.id,
      organizacao_id: org.id,
      nome:           usuario_nome,
      email,
      role:           "admin",
    })

  if (userError) {
    // Rollback
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
    await supabaseAdmin.from("organizacoes").delete().eq("id", org.id)
    return NextResponse.json(
      { data: null, error: { code: "USER_ERROR", message: userError.message } },
      { status: 500 },
    )
  }

  return NextResponse.json(
    { data: { organizacao_id: org.id, usuario_id: authUser.user.id }, error: null },
    { status: 201 },
  )
}
