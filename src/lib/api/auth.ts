import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export interface AuthProfile {
  id: string
  nome: string
  role: string
  organizacao_id: string
}

export interface AuthResult {
  profile: AuthProfile | null
  supabase: Awaited<ReturnType<typeof createClient>>
  unauthorized: boolean
}

export async function getAuthUser(): Promise<AuthResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { profile: null, supabase, unauthorized: true }
  }

  const { data: profile } = await supabase
    .from("usuarios")
    .select("id, nome, role, organizacao_id")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return { profile: null, supabase, unauthorized: true }
  }

  return { profile: profile as AuthProfile, supabase, unauthorized: false }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status })
}

export function err(message: string, status: number, code = "ERROR") {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
