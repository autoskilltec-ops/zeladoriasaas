"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Building2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Organizacao {
  id:        string
  nome:      string
  cnpj:      string | null
  telefone:  string | null
  email:     string | null
  created_at: string
}

export default function OrganizacaoPage() {
  const supabase = createClient()

  const [org,     setOrg]     = useState<Organizacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const [form, setForm] = useState({
    nome:     "",
    cnpj:     "",
    telefone: "",
    email:    "",
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("usuarios")
        .select("organizacao_id")
        .eq("id", user.id)
        .single()
      if (!profile) return

      const { data } = await supabase
        .from("organizacoes")
        .select("id, nome, cnpj, telefone, email, created_at")
        .eq("id", profile.organizacao_id)
        .single()

      if (data) {
        setOrg(data)
        setForm({
          nome:     data.nome,
          cnpj:     data.cnpj ?? "",
          telefone: data.telefone ?? "",
          email:    data.email ?? "",
        })
      }
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim() || !org) return
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error: dbErr } = await supabase
      .from("organizacoes")
      .update({
        nome:     form.nome.trim(),
        cnpj:     form.cnpj.trim() || null,
        telefone: form.telefone.trim() || null,
        email:    form.email.trim() || null,
      })
      .eq("id", org.id)

    setSaving(false)
    if (dbErr) setError("Erro ao salvar: " + dbErr.message)
    else setSaved(true)
  }

  if (loading) {
    return (
      <div className="px-4 pt-4 space-y-3 animate-pulse max-w-2xl mx-auto">
        <div className="card h-[300px]" />
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 pb-6 max-w-2xl mx-auto">

      {/* ── Identidade visual ─────────────────────────────────────────── */}
      <div className="card mb-3 flex items-center gap-3">
        <div
          className="w-[56px] h-[56px] rounded-[14px] flex items-center justify-center shrink-0 text-white text-[22px] font-medium"
          style={{ background: "var(--green-700)" }}
        >
          {form.nome[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-[#1a2e22] truncate">{form.nome || "—"}</p>
          {org?.created_at && (
            <p className="text-[11px] text-[#9ca3af] mt-0.5">
              Criada em {new Date(org.created_at).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
        <Building2 size={18} className="text-[#c4cdc7] ml-auto shrink-0" />
      </div>

      {/* ── Formulário ────────────────────────────────────────────────── */}
      <div className="card">
        <p className="card-title">Dados da organização</p>
        <form onSubmit={handleSave}>
          <div className="space-y-3 mb-4">
            <div>
              <label className="field-label" htmlFor="org-nome">Nome *</label>
              <input
                id="org-nome"
                type="text"
                value={form.nome}
                onChange={(e) => { setForm((p) => ({ ...p, nome: e.target.value })); setSaved(false) }}
                className={cn("field-input", form.nome && "has-value")}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="org-cnpj">CNPJ</label>
              <input
                id="org-cnpj"
                type="text"
                value={form.cnpj}
                onChange={(e) => { setForm((p) => ({ ...p, cnpj: e.target.value })); setSaved(false) }}
                className={cn("field-input", form.cnpj && "has-value")}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="org-telefone">Telefone</label>
              <input
                id="org-telefone"
                type="tel"
                value={form.telefone}
                onChange={(e) => { setForm((p) => ({ ...p, telefone: e.target.value })); setSaved(false) }}
                className={cn("field-input", form.telefone && "has-value")}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="org-email">E-mail de contato</label>
              <input
                id="org-email"
                type="email"
                value={form.email}
                onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setSaved(false) }}
                className={cn("field-input", form.email && "has-value")}
                placeholder="contato@empresa.com"
              />
            </div>
          </div>

          {error && <p className="text-[11px] text-[#ef4444] mb-2">{error}</p>}
          {saved && (
            <div className="flex items-center gap-1.5 mb-2 text-[12px] text-[var(--green-600)]">
              <CheckCircle2 size={14} />
              Dados salvos com sucesso!
            </div>
          )}

          <button type="submit" disabled={saving || !form.nome.trim()} className="btn-primary">
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </form>
      </div>

    </div>
  )
}
