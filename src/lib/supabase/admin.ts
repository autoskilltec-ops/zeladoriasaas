import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

function getAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
  }
  return _admin
}

// Proxy mantém a API idêntica — nenhum arquivo importador precisa mudar
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get: (_, prop: string | symbol) => (getAdmin() as any)[prop],
})
