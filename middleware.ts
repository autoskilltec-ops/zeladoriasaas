import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─── Rotas ────────────────────────────────────────────────────────────────────
const PUBLIC_ROUTES = ['/login', '/cadastro', '/recuperar-senha', '/aceitar-convite']
const ADMIN_ROUTES  = ['/admin']

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_URL!,
  'https://zeladoriasaas.vercel.app',
]

export function corsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = !!origin && ALLOWED_ORIGINS.includes(origin)
  return {
    'Access-Control-Allow-Origin':  isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
  }
}

// ─── Middleware ────────────────────────────────────────────────────────────────
export async function middleware(request: NextRequest) {
  // `response` pode ser substituído pelo setAll do cookie handler; usa `request`
  // para propagar headers modificados (necessário para refresh do token Supabase)
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Grava no request para que handlers downstream enxerguem o token atualizado
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Recria o response com o request atualizado e persiste os cookies no browser
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const pathname = request.nextUrl.pathname
  const origin   = request.headers.get('origin')

  // Preflight OPTIONS para API routes
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
  }

  // Rejeita origens não permitidas em chamadas às API routes
  if (pathname.startsWith('/api/') && origin) {
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new NextResponse(JSON.stringify({ error: 'FORBIDDEN_ORIGIN' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    // Adiciona cabeçalhos CORS na resposta de rotas API autorizadas
    Object.entries(corsHeaders(origin)).forEach(([k, v]) =>
      response.headers.set(k, v)
    )
  }

  // Chama getUser (mais seguro que getSession — valida JWT no servidor)
  const { data: { user } } = await supabase.auth.getUser()

  // Rotas públicas: deixa passar; redireciona para app se já autenticado
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    if (user) return NextResponse.redirect(new URL('/inspecao', request.url))
    return response
  }

  // Sem sessão: redireciona para login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Verifica role para rotas admin
  if (ADMIN_ROUTES.some(r => pathname.startsWith(r))) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('role')
      .eq('id', user.id)
      .single()

    if (usuario?.role !== 'admin') {
      return NextResponse.redirect(new URL('/inspecao', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)'],
}
