"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Eye, EyeOff, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

const ROLE_LABELS: Record<string, string> = {
  admin:    "Administrador",
  gestor:   "Gestor",
  inspetor: "Inspetor",
  zelador:  "Zelador",
}

export default function PerfilPage() {
  const supabase = useRef(createClient()).current

  const [nome,       setNome]       = useState("")
  const [email,      setEmail]      = useState("")
  const [role,       setRole]       = useState("")
  const [loading,    setLoading]    = useState(true)

  const [senha,      setSenha]      = useState("")
  const [confirmar,  setConfirmar]  = useState("")
  const [showP,      setShowP]      = useState(false)
  const [savingP,    setSavingP]    = useState(false)
  const [senhaOk,    setSenhaOk]    = useState(false)
  const [senhaErr,   setSenhaErr]   = useState<string | null>(null)

  const [savingN,    setSavingN]    = useState(false)
  const [nomeOk,     setNomeOk]     = useState(false)
  const [nomeErr,    setNomeErr]    = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("usuarios")
        .select("nome, email, role")
        .eq("id", user.id)
        .single()

      if (data) {
        setNome(data.nome)
        setEmail(data.email)
        setRole(data.role)
      }
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveNome(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setSavingN(true)
    setNomeErr(null)
    setNomeOk(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingN(false); return }

    const { error } = await supabase
      .from("usuarios")
      .update({ nome: nome.trim() })
      .eq("id", user.id)

    setSavingN(false)
    if (error) setNomeErr("Erro ao salvar nome")
    else setNomeOk(true)
  }

  const passHasLetter = /[a-zA-Z]/.test(senha)
  const passHasNumber = /[0-9]/.test(senha)
  const passStrong    = senha.length >= 8 && passHasLetter && passHasNumber

  async function handleSaveSenha(e: React.FormEvent) {
    e.preventDefault()
    setSenhaErr(null)
    setSenhaOk(false)

    if (senha.length < 8) { setSenhaErr("Mínimo 8 caracteres"); return }
    if (!passHasLetter || !passHasNumber) { setSenhaErr("Deve conter letras e números"); return }
    if (senha !== confirmar) { setSenhaErr("As senhas não coincidem"); return }

    setSavingP(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSavingP(false)

    if (error) setSenhaErr("Erro ao atualizar senha: " + error.message)
    else {
      setSenhaOk(true)
      setSenha("")
      setConfirmar("")
    }
  }

  if (loading) {
    return (
      <div className="px-4 pt-4 space-y-3 animate-pulse">
        <div className="card h-[80px]" />
        <div className="card h-[140px]" />
        <div className="card h-[160px]" />
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 pb-2">

      {/* ── Informações da conta (read-only) ────────────────────────── */}
      <div className="card mb-3">
        <p className="card-title">Dados da conta</p>
        <div className="space-y-2">
          <div className="flex justify-between items-center py-1">
            <span className="text-[12px] text-[#6b7280]">E-mail</span>
            <span className="text-[13px] text-[#1a2e22] font-medium">{email}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-[12px] text-[#6b7280]">Perfil</span>
            <span className="text-[13px] text-[#1a2e22] font-medium">{ROLE_LABELS[role] ?? role}</span>
          </div>
        </div>
      </div>

      {/* ── Alterar nome ─────────────────────────────────────────────── */}
      <div className="card mb-3">
        <p className="card-title">Nome de exibição</p>
        <form onSubmit={handleSaveNome}>
          <div className="mb-3">
            <label className="field-label" htmlFor="nome">Nome</label>
            <input
              id="nome"
              type="text"
              value={nome}
              onChange={(e) => { setNome(e.target.value); setNomeOk(false) }}
              className={cn("field-input", nome.length > 0 && "has-value")}
            />
          </div>

          {nomeErr && <p className="text-[11px] text-[#ef4444] mb-2">{nomeErr}</p>}
          {nomeOk  && (
            <div className="flex items-center gap-1.5 mb-2 text-[12px] text-[var(--green-600)]">
              <CheckCircle2 size={14} />
              Nome atualizado!
            </div>
          )}

          <button type="submit" disabled={savingN || !nome.trim()} className="btn-primary">
            {savingN ? "Salvando…" : "Salvar nome"}
          </button>
        </form>
      </div>

      {/* ── Alterar senha ────────────────────────────────────────────── */}
      <div className="card">
        <p className="card-title">Alterar senha</p>
        <form onSubmit={handleSaveSenha}>
          <div className="space-y-3 mb-3">
            <div>
              <label className="field-label" htmlFor="nova-senha">Nova senha</label>
              <div className="relative">
                <input
                  id="nova-senha"
                  type={showP ? "text" : "password"}
                  value={senha}
                  onChange={(e) => { setSenha(e.target.value); setSenhaOk(false) }}
                  placeholder="Mínimo 8 caracteres"
                  className={cn("field-input pr-[40px]", senha.length > 0 && "has-value")}
                />
                <button
                  type="button"
                  onClick={() => setShowP((v) => !v)}
                  className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[#9ca3af]"
                  tabIndex={-1}
                  aria-label={showP ? "Ocultar" : "Mostrar"}
                >
                  {showP ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {senha.length > 0 && !passStrong && (
                <p className="mt-1 text-[11px] text-[#f97316]">
                  {senha.length < 8 ? "Mínimo 8 caracteres" : "Deve conter letras e números"}
                </p>
              )}
            </div>
            <div>
              <label className="field-label" htmlFor="confirmar-senha">Confirmar nova senha</label>
              <input
                id="confirmar-senha"
                type={showP ? "text" : "password"}
                value={confirmar}
                onChange={(e) => { setConfirmar(e.target.value); setSenhaOk(false) }}
                placeholder="Repita a nova senha"
                className={cn("field-input", confirmar.length > 0 && "has-value")}
              />
            </div>
          </div>

          {senhaErr && <p className="text-[11px] text-[#ef4444] mb-2">{senhaErr}</p>}
          {senhaOk  && (
            <div className="flex items-center gap-1.5 mb-2 text-[12px] text-[var(--green-600)]">
              <CheckCircle2 size={14} />
              Senha atualizada com sucesso!
            </div>
          )}

          <button
            type="submit"
            disabled={savingP || !passStrong}
            className="btn-primary"
          >
            {savingP ? "Salvando…" : "Atualizar senha"}
          </button>
        </form>
      </div>

    </div>
  )
}
