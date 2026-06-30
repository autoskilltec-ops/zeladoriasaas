import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

// ─── Rotas públicas ───────────────────────────────────────────────────────────
const PUBLIC_PATHS = ["/login", "/cadastro", "/api/cadastro", "/recuperar-senha", "/api/recuperar-senha", "/atualizar-senha"]

// ─── CORS ────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_URL ?? "",
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean)

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    "Access-Control-Allow-Origin":  allowed ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age":       "86400",
  }
}

// ─── Rate limiting (in-memory — por instância) ────────────────────────────────
// Limita endpoints sensíveis. Em produção multi-instância, migrar para Upstash Redis.
interface RateEntry { count: number; resetAt: number }
const rateLimitStore = new Map<string, RateEntry>()

const RATE_RULES: Record<string, { max: number; windowMs: number }> = {
  "/api/inspecoes":         { max: 20,  windowMs: 60_000  },
  "/api/nao-conformidades": { max: 50,  windowMs: 60_000  },
  "/api/upload":            { max: 10,  windowMs: 60_000  },
  "/api/dashboard":         { max: 30,  windowMs: 60_000  },
  "/api/cadastro":          { max: 3,   windowMs: 600_000 }, // 3 cadastros/10 min por IP
  "/login":                 { max: 5,   windowMs: 900_000 }, // 5 tentativas/15 min
}

function checkRateLimit(pathname: string, ip: string): { limited: boolean; retryAfter: number } {
  const rule = Object.entries(RATE_RULES).find(([path]) => pathname.startsWith(path))
  if (!rule) return { limited: false, retryAfter: 0 }

  const [, { max, windowMs }] = rule
  const key   = `${ip}:${rule[0]}`
  const now   = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return { limited: false, retryAfter: 0 }
  }

  entry.count++
  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { limited: true, retryAfter }
  }

  return { limited: false, retryAfter: 0 }
}

// Limpa entradas expiradas ocasionalmente
function pruneRateStore() {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key)
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const origin = request.headers.get("origin")
  const ip     = request.headers.get("x-forwarded-for")?.split(",")[0].trim()
             ?? request.headers.get("x-real-ip")
             ?? "unknown"

  // Limpa store periodicamente (1% das requisições)
  if (Math.random() < 0.01) pruneRateStore()

  // OPTIONS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) })
  }

  // Rate limiting
  if (pathname.startsWith("/api/") || pathname === "/login") {
    const { limited, retryAfter } = checkRateLimit(pathname, ip)
    if (limited) {
      return NextResponse.json(
        { data: null, error: { code: "RATE_LIMITED", message: "Muitas requisições. Tente novamente em breve." } },
        {
          status: 429,
          headers: {
            "Retry-After":  String(retryAfter),
            "X-RateLimit-Reset": String(retryAfter),
            ...getCorsHeaders(origin),
          },
        },
      )
    }
  }

  // Auth check via Supabase
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  let user: { id: string } | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    // Falha de rede ou env var ausente — trata como não autenticado
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (user && isPublic && pathname !== "/atualizar-senha") {
    const url = request.nextUrl.clone()
    url.pathname = "/inspecao"
    return NextResponse.redirect(url)
  }

  // Adiciona headers CORS na resposta
  const corsHeaders = getCorsHeaders(origin)
  Object.entries(corsHeaders).forEach(([k, v]) => supabaseResponse.headers.set(k, v))

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
