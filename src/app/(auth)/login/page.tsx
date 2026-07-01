"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, ClipboardCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const [email,       setEmail]       = useState("")
  const [password,    setPassword]    = useState("")
  const [showPass,    setShowPass]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email:    email.trim(),
      password,
    })

    if (authError) {
      setError("E-mail ou senha incorretos. Verifique e tente novamente.")
      setLoading(false)
      return
    }

    // Redireciona para a página que o usuário tentava acessar (ou /dashboard)
    const next = searchParams.get("next") ?? "/dashboard"
    router.push(next)
    router.refresh()
  }

  const canSubmit = email.trim().length > 0 && password.length >= 6

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4 py-8">
      <div className="w-full max-w-[360px]">

        {/* Identidade visual */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-[56px] h-[56px] rounded-[16px] flex items-center justify-center mb-4"
            style={{ background: "var(--green-700)" }}
          >
            <ClipboardCheck size={28} color="white" strokeWidth={1.8} />
          </div>
          <h1 className="text-[20px] font-medium text-[#1a2e22] tracking-tight">
            Zeladoria
          </h1>
          <p className="text-[13px] text-[#6b7280] mt-0.5">
            Acesse sua conta
          </p>
        </div>

        {/* Card do formulário */}
        <div className="card" style={{ padding: "20px" }}>
          <form onSubmit={handleLogin} noValidate>
            <div className="space-y-4">

              {/* E-mail */}
              <div>
                <label className="field-label" htmlFor="email">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className={cn(
                    "field-input",
                    email.trim().length > 0 && "has-value",
                  )}
                />
              </div>

              {/* Senha */}
              <div>
                <label className="field-label" htmlFor="password">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={cn(
                      "field-input pr-[40px]",
                      password.length > 0 && "has-value",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280] transition-colors"
                    aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                    tabIndex={-1}
                  >
                    {showPass
                      ? <EyeOff size={16} />
                      : <Eye     size={16} />
                    }
                  </button>
                </div>
              </div>

            </div>

            {/* Erro */}
            {error && (
              <div
                role="alert"
                className="mt-3 px-3 py-2.5 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[12px] text-[#b91c1c]"
              >
                {error}
              </div>
            )}

            {/* Botão entrar */}
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="btn-primary mt-5"
            >
              {loading ? (
                <>
                  <span
                    className="inline-block w-[15px] h-[15px] border-2 border-white border-t-transparent rounded-full animate-spin"
                    aria-hidden
                  />
                  Entrando…
                </>
              ) : (
                "Entrar"
              )}
            </button>

          </form>
        </div>

        {/* Links secundários */}
        <div className="flex flex-col items-center gap-2 mt-4">
          <p className="text-center text-[12px] text-[#9ca3af]">
            Esqueceu a senha?{" "}
            <a
              href="/recuperar-senha"
              className="text-[var(--green-600)] hover:underline"
            >
              Recuperar acesso
            </a>
          </p>
          <p className="text-center text-[12px] text-[#9ca3af]">
            Não tem conta?{" "}
            <a
              href="/cadastro"
              className="text-[var(--green-600)] hover:underline font-medium"
            >
              Criar conta
            </a>
          </p>
        </div>

      </div>
    </div>
  )
}
