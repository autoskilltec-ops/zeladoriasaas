"use client"

import { useState } from "react"
import { ClipboardCheck, ArrowLeft, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export default function RecuperarSenhaPage() {
  const supabase = createClient()

  const [email,   setEmail]   = useState("")
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/atualizar-senha` },
    )

    setLoading(false)

    if (resetError) {
      setError("Erro ao enviar e-mail. Verifique o endereço e tente novamente.")
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f2f4f3] px-4 py-8">
        <div className="w-full max-w-[360px] text-center">
          <div className="flex justify-center mb-5">
            <div className="w-[64px] h-[64px] rounded-full flex items-center justify-center" style={{ background: "var(--green-50)", border: "1.5px solid var(--green-100)" }}>
              <CheckCircle2 size={32} style={{ color: "var(--green-600)" }} strokeWidth={1.5} />
            </div>
          </div>
          <h2 className="text-[18px] font-medium text-[#1a2e22] mb-2">E-mail enviado!</h2>
          <p className="text-[13px] text-[#6b7280] mb-6 leading-[1.6]">
            Enviamos um link para <strong className="text-[#374151]">{email}</strong>.
            Verifique sua caixa de entrada e siga as instruções.
          </p>
          <a href="/login" className="btn-secondary inline-flex w-auto px-6">
            <ArrowLeft size={15} />
            Voltar para o login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f2f4f3] px-4 py-8">
      <div className="w-full max-w-[360px]">

        <div className="flex flex-col items-center mb-8">
          <div
            className="w-[56px] h-[56px] rounded-[16px] flex items-center justify-center mb-4"
            style={{ background: "var(--green-700)" }}
          >
            <ClipboardCheck size={28} color="white" strokeWidth={1.8} />
          </div>
          <h1 className="text-[20px] font-medium text-[#1a2e22] tracking-tight">
            Recuperar acesso
          </h1>
          <p className="text-[13px] text-[#6b7280] mt-0.5 text-center max-w-[240px] leading-[1.5]">
            Informe seu e-mail e enviaremos um link para redefinir a senha.
          </p>
        </div>

        <div className="card" style={{ padding: "20px" }}>
          <form onSubmit={handleSubmit} noValidate>
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
                className={cn("field-input", email.trim().length > 0 && "has-value")}
              />
            </div>

            {error && (
              <div role="alert" className="mt-3 px-3 py-2.5 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[12px] text-[#b91c1c]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || email.trim().length === 0}
              className="btn-primary mt-5"
            >
              {loading ? (
                <>
                  <span className="inline-block w-[15px] h-[15px] border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                  Enviando…
                </>
              ) : (
                "Enviar link de recuperação"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-[#9ca3af] mt-4">
          <a href="/login" className="text-[var(--green-600)] hover:underline flex items-center justify-center gap-1">
            <ArrowLeft size={12} />
            Voltar para o login
          </a>
        </p>

      </div>
    </div>
  )
}
