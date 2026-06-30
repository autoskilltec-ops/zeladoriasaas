import { NextRequest } from "next/server"
import { z } from "zod"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sanitizeShort } from "@/lib/utils/sanitize"
import { auditLog } from "@/lib/audit"

// Senha forte: mínimo 8 chars, ao menos 1 letra e 1 número
const strongPassword = z
  .string()
  .min(8, "Senha deve ter ao menos 8 caracteres")
  .refine(
    (p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p),
    "Senha deve conter letras e números",
  )

const schema = z.object({
  org_nome:     z.string().min(2, "Nome da organização muito curto").max(100),
  usuario_nome: z.string().min(2, "Nome muito curto").max(100),
  email:        z.string().email("E-mail inválido"),
  password:     strongPassword,
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

  const { email, password } = parsed.data
  const org_nome     = sanitizeShort(parsed.data.org_nome)
  const usuario_nome = sanitizeShort(parsed.data.usuario_nome)
  const slug         = slugify(org_nome)

  // Verifica duplicidade de e-mail antes de criar a org (evita rollback desnecessário)
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
  const emailExists = existingUsers?.users.some(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  )
  if (emailExists) {
    return NextResponse.json(
      { data: null, error: { code: "EMAIL_EXISTS", message: "E-mail já cadastrado" } },
      { status: 409 },
    )
  }

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
    email_confirm: true,
  })

  if (authError || !authUser?.user) {
    await supabaseAdmin.from("organizacoes").delete().eq("id", org.id)
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: authError?.message ?? "Erro ao criar usuário" } },
      { status: 500 },
    )
  }

  // 3. Cria o perfil como admin
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
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
    await supabaseAdmin.from("organizacoes").delete().eq("id", org.id)
    return NextResponse.json(
      { data: null, error: { code: "USER_ERROR", message: userError.message } },
      { status: 500 },
    )
  }

  // Audit
  await auditLog({
    user_id:        authUser.user.id,
    organizacao_id: org.id,
    action:         "org.criar",
    resource_id:    org.id,
    request,
    metadata:       { org_nome, email },
  })

  return NextResponse.json(
    { data: { organizacao_id: org.id, usuario_id: authUser.user.id }, error: null },
    { status: 201 },
  )
}
