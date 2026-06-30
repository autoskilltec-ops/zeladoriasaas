"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Plus, UserCheck, UserX, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface Usuario {
  id:         string
  nome:       string
  email:      string
  role:       string
  ativo:      boolean
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  admin:    "Admin",
  gestor:   "Gestor",
  inspetor: "Inspetor",
  zelador:  "Zelador",
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin:    { bg: "#fef3c7", color: "#92400e" },
  gestor:   { bg: "#dbeafe", color: "#1e40af" },
  inspetor: { bg: "var(--green-50)",  color: "var(--green-700)" },
  zelador:  { bg: "#f3f4f6", color: "#374151" },
}

const ROLES = ["admin", "gestor", "inspetor", "zelador"] as const

type Role = typeof ROLES[number]

interface NovoUsuarioForm {
  nome:     string
  email:    string
  senha:    string
  role:     Role
}

function formatDate(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR")
}

export default function UsuariosPage() {
  const supabase = createClient()

  const [usuarios,  setUsuarios]  = useState<Usuario[]>([])
  const [loading,   setLoading]   = useState(true)
  const [busca,     setBusca]     = useState("")
  const [orgId,     setOrgId]     = useState<string | null>(null)

  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState<NovoUsuarioForm>({ nome: "", email: "", senha: "", role: "inspetor" })
  const [saving,    setSaving]    = useState(false)
  const [formErr,   setFormErr]   = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from("usuarios").select("organizacao_id").eq("id", user.id).single()
      if (!profile) return

      setOrgId(profile.organizacao_id)

      const { data } = await supabase
        .from("usuarios")
        .select("id, nome, email, role, ativo, created_at")
        .eq("organizacao_id", profile.organizacao_id)
        .order("nome")

      setUsuarios(data ?? [])
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = usuarios.filter((u) =>
    u.nome.toLowerCase().includes(busca.toLowerCase()) ||
    u.email.toLowerCase().includes(busca.toLowerCase())
  )

  async function handleNovoUsuario(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim() || !form.email.trim() || form.senha.length < 6) {
      setFormErr("Preencha todos os campos. Senha mínima: 6 caracteres.")
      return
    }
    setSaving(true)
    setFormErr(null)

    const res = await fetch("/api/admin/usuarios", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...form, organizacao_id: orgId }),
    })
    const json = await res.json()
    setSaving(false)

    if (json.error) {
      setFormErr(json.error.message ?? "Erro ao criar usuário")
    } else {
      setUsuarios((prev) => [...prev, json.data.usuario].sort((a, b) => a.nome.localeCompare(b.nome)))
      setShowForm(false)
      setForm({ nome: "", email: "", senha: "", role: "inspetor" })
    }
  }

  async function toggleAtivo(usuario: Usuario) {
    const { error } = await supabase
      .from("usuarios")
      .update({ ativo: !usuario.ativo })
      .eq("id", usuario.id)

    if (!error) {
      setUsuarios((prev) => prev.map((u) => u.id === usuario.id ? { ...u, ativo: !u.ativo } : u))
    }
  }

  return (
    <div className="px-4 pt-4 pb-6 max-w-2xl mx-auto">

      {/* ── Cabeçalho ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] text-[#6b7280]">{filtrados.length} usuário{filtrados.length !== 1 ? "s" : ""}</p>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setFormErr(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white transition-colors"
          style={{ background: "var(--green-700)" }}
        >
          <Plus size={14} />
          Novo usuário
        </button>
      </div>

      {/* ── Formulário novo usuário ───────────────────────────────────── */}
      {showForm && (
        <div className="card mb-3">
          <p className="card-title">Novo usuário</p>
          <form onSubmit={handleNovoUsuario}>
            <div className="space-y-3 mb-3">
              <div>
                <label className="field-label">Nome</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                  className={cn("field-input", form.nome && "has-value")}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="field-label">E-mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className={cn("field-input", form.email && "has-value")}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="field-label">Senha inicial</label>
                <input
                  type="password"
                  value={form.senha}
                  onChange={(e) => setForm((p) => ({ ...p, senha: e.target.value }))}
                  className={cn("field-input", form.senha && "has-value")}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label className="field-label">Perfil</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as Role }))}
                  className={cn("field-input has-value")}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
            </div>

            {formErr && <p className="text-[11px] text-[#ef4444] mb-2">{formErr}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormErr(null) }}
                className="flex-1 py-2 rounded-lg border border-[#e0e8e2] text-[13px] text-[#6b7280]"
              >
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="flex-1 btn-primary">
                {saving ? "Criando…" : "Criar usuário"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Busca ─────────────────────────────────────────────────────── */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          className="field-input pl-[32px]"
        />
      </div>

      {/* ── Lista ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="card h-[68px]" />)}
        </div>
      ) : filtrados.length === 0 ? (
        <p className="text-center text-[13px] text-[#9ca3af] py-8">Nenhum usuário encontrado</p>
      ) : (
        <div className="space-y-2">
          {filtrados.map((u) => {
            const rc = ROLE_COLORS[u.role] ?? { bg: "#f3f4f6", color: "#374151" }
            return (
              <div key={u.id} className={cn("card", !u.ativo && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <div
                    className="w-[40px] h-[40px] rounded-full flex items-center justify-center shrink-0 text-[15px] font-medium text-white"
                    style={{ background: u.ativo ? "var(--green-700)" : "#9ca3af" }}
                  >
                    {u.nome[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[13px] font-medium text-[#1a2e22]">{u.nome}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: rc.bg, color: rc.color }}
                      >
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9ca3af]">{u.email}</p>
                    <p className="text-[10px] text-[#c4cdc7] mt-0.5">Desde {formatDate(u.created_at)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAtivo(u)}
                    title={u.ativo ? "Desativar" : "Ativar"}
                    className="mt-1 text-[#9ca3af] hover:text-[var(--green-700)] transition-colors"
                  >
                    {u.ativo ? <UserCheck size={16} /> : <UserX size={16} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
