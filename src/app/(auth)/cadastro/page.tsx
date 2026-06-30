"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ClipboardCheck, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

export default function CadastroPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [orgNome,      setOrgNome]      = useState("")
  const [usuarioNome,  setUsuarioNome]  = useState("")
  const [email,        setEmail]        = useState("")
  const [password,     setPassword]     = useState("")
  const [showPass,     setShowPass]     = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch("/api/cadastro", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        org_nome:     orgNome.trim(),
        usuario_nome: usuarioNome.trim(),
        email:        email.trim(),
        password,
      }),
    })

    const json = await res.json()

    if (!res.ok) {
      setError(json?.error?.message ?? "Erro ao criar conta. Tente novamente.")
      setLoading(false)
      return
    }

    // Faz login automaticamente após o cadastro
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })

    if (loginError) {
      // Conta criada com sucesso mas login falhou — redireciona para login
      router.push("/login?cadastro=ok")
      return
    }

    router.push("/inspecao")
    router.refresh()
  }

  const canSubmit =
    orgNome.trim().length >= 2 &&
    usuarioNome.trim().length >= 2 &&
    email.trim().length > 0 &&
    password.length >= 8

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f2f4f3] px-4 py-8">
      <div className="w-full max-w-[380px]">

        <div className="flex flex-col items-center mb-8">
          <div
            className="w-[56px] h-[56px] rounded-[16px] flex items-center justify-center mb-4"
            style={{ background: "var(--green-700)" }}
          >
            <ClipboardCheck size={28} color="white" strokeWidth={1.8} />
          </div>
          <h1 className="text-[20px] font-medium text-[#1a2e22] tracking-tight">
            Criar conta
          </h1>
          <p className="text-[13px] text-[#6b7280] mt-0.5">
            Configure sua organização
          </p>
        </div>

        <div className="card" style={{ padding: "20px" }}>
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">

              {/* Nome da organização */}
              <div>
                <label className="field-label" htmlFor="org-nome">
                  Nome da organização <span className="req">*</span>
                </label>
                <input
                  id="org-nome"
                  type="text"
                  value={orgNome}
                  onChange={(e) => setOrgNome(e.target.value)}
                  placeholder="Ex: Condomínio Central"
                  required
                  className={cn("field-input", orgNome.trim().length > 0 && "has-value")}
                />
              </div>

              {/* Nome do usuário */}
              <div>
                <label className="field-label" htmlFor="usuario-nome">
                  Seu nome <span className="req">*</span>
                </label>
                <input
                  id="usuario-nome"
                  type="text"
                  value={usuarioNome}
                  onChange={(e) => setUsuarioNome(e.target.value)}
                  placeholder="Nome completo"
                  required
                  className={cn("field-input", usuarioNome.trim().length > 0 && "has-value")}
                />
              </div>

              {/* E-mail */}
              <div>
                <label className="field-label" htmlFor="email">
                  E-mail <span className="req">*</span>
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
                  className={cn("field-input", email.trim().length > 0 && "has-value")}
                />
              </div>

              {/* Senha */}
              <div>
                <label className="field-label" htmlFor="password">
                  Senha <span className="req">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    className={cn("field-input pr-[40px]", password.length > 0 && "has-value")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280]"
                    aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password.length > 0 && password.length < 8 && (
                  <p className="mt-1 text-[11px] text-[#f97316]">Mínimo 8 caracteres</p>
                )}
              </div>

            </div>

            {error && (
              <div role="alert" className="mt-3 px-3 py-2.5 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[12px] text-[#b91c1c]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="btn-primary mt-5"
            >
              {loading ? (
                <>
                  <span className="inline-block w-[15px] h-[15px] border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                  Criando conta…
                </>
              ) : (
                "Criar conta e entrar"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-[#9ca3af] mt-4">
          Já tem conta?{" "}
          <a href="/login" className="text-[var(--green-600)] hover:underline">
            Entrar
          </a>
        </p>

      </div>
    </div>
  )
}
