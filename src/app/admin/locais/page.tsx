"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Plus, MapPin, Pencil, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface Local {
  id:          string
  nome:        string
  bloco:       string | null
  andar:       string | null
  tipo:        string | null
  ativo:       boolean
  created_at:  string
}

interface LocalForm {
  nome:  string
  bloco: string
  andar: string
  tipo:  string
}

const EMPTY_FORM: LocalForm = { nome: "", bloco: "", andar: "", tipo: "" }

export default function LocaisPage() {
  const supabase = createClient()

  const [locais,   setLocais]   = useState<Local[]>([])
  const [loading,  setLoading]  = useState(true)
  const [orgId,    setOrgId]    = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState<LocalForm>(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)
  const [formErr,  setFormErr]  = useState<string | null>(null)

  const [editId,   setEditId]   = useState<string | null>(null)
  const [editForm, setEditForm] = useState<LocalForm>(EMPTY_FORM)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from("usuarios").select("organizacao_id").eq("id", user.id).single()
      if (!profile) return
      setOrgId(profile.organizacao_id)
      const { data } = await supabase
        .from("locais")
        .select("id, nome, bloco, andar, tipo, ativo, created_at")
        .eq("organizacao_id", profile.organizacao_id)
        .order("nome")
      setLocais(data ?? [])
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) { setFormErr("Nome obrigatório"); return }
    setSaving(true)
    setFormErr(null)

    const { data, error } = await supabase
      .from("locais")
      .insert({
        nome:           form.nome.trim(),
        bloco:          form.bloco.trim() || null,
        andar:          form.andar.trim() || null,
        tipo:           form.tipo.trim() || null,
        organizacao_id: orgId,
        ativo:          true,
      })
      .select("id, nome, bloco, andar, tipo, ativo, created_at")
      .single()

    setSaving(false)
    if (error) { setFormErr("Erro ao criar local: " + error.message); return }
    setLocais((prev) => [...prev, data!].sort((a, b) => a.nome.localeCompare(b.nome)))
    setShowForm(false)
    setForm(EMPTY_FORM)
  }

  async function handleSaveEdit(id: string) {
    if (!editForm.nome.trim()) return

    const { data, error } = await supabase
      .from("locais")
      .update({
        nome:  editForm.nome.trim(),
        bloco: editForm.bloco.trim() || null,
        andar: editForm.andar.trim() || null,
        tipo:  editForm.tipo.trim() || null,
      })
      .eq("id", id)
      .select("id, nome, bloco, andar, tipo, ativo, created_at")
      .single()

    if (!error && data) {
      setLocais((prev) => prev.map((l) => l.id === id ? data : l))
    }
    setEditId(null)
  }

  async function toggleAtivo(local: Local) {
    const { error } = await supabase.from("locais").update({ ativo: !local.ativo }).eq("id", local.id)
    if (!error) setLocais((prev) => prev.map((l) => l.id === local.id ? { ...l, ativo: !l.ativo } : l))
  }

  return (
    <div className="px-4 pt-4 pb-6 max-w-2xl mx-auto">

      {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] text-[#6b7280]">{locais.length} local{locais.length !== 1 ? "is" : ""}</p>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setFormErr(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white"
          style={{ background: "var(--green-700)" }}
        >
          <Plus size={14} />
          Novo local
        </button>
      </div>

      {/* ── Formulário novo local ─────────────────────────────────────── */}
      {showForm && (
        <div className="card mb-3">
          <p className="card-title">Novo local</p>
          <form onSubmit={handleCreate}>
            <div className="space-y-3 mb-3">
              <div>
                <label className="field-label">Nome *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                  className={cn("field-input", form.nome && "has-value")}
                  placeholder="Ex: Bloco A — Corredor"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="field-label">Bloco</label>
                  <input
                    type="text"
                    value={form.bloco}
                    onChange={(e) => setForm((p) => ({ ...p, bloco: e.target.value }))}
                    className={cn("field-input", form.bloco && "has-value")}
                    placeholder="Ex: A"
                  />
                </div>
                <div>
                  <label className="field-label">Andar</label>
                  <input
                    type="text"
                    value={form.andar}
                    onChange={(e) => setForm((p) => ({ ...p, andar: e.target.value }))}
                    className={cn("field-input", form.andar && "has-value")}
                    placeholder="Ex: 2º"
                  />
                </div>
              </div>
              <div>
                <label className="field-label">Tipo</label>
                <input
                  type="text"
                  value={form.tipo}
                  onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                  className={cn("field-input", form.tipo && "has-value")}
                  placeholder="Ex: Corredor, Banheiro…"
                />
              </div>
            </div>
            {formErr && <p className="text-[11px] text-[#ef4444] mb-2">{formErr}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-lg border border-[#e0e8e2] text-[13px] text-[#6b7280]">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="flex-1 btn-primary">
                {saving ? "Salvando…" : "Criar local"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Lista ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="card h-[60px]" />)}
        </div>
      ) : locais.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <MapPin size={32} className="text-[#c4cdc7] mb-3" strokeWidth={1.5} />
          <p className="text-[13px] text-[#9ca3af]">Nenhum local cadastrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {locais.map((local) => {
            const isEditing = editId === local.id
            return (
              <div key={local.id} className={cn("card", !local.ativo && "opacity-60")}>
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editForm.nome}
                      onChange={(e) => setEditForm((p) => ({ ...p, nome: e.target.value }))}
                      className="field-input has-value"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editForm.bloco}
                        onChange={(e) => setEditForm((p) => ({ ...p, bloco: e.target.value }))}
                        placeholder="Bloco"
                        className={cn("field-input", editForm.bloco && "has-value")}
                      />
                      <input
                        type="text"
                        value={editForm.andar}
                        onChange={(e) => setEditForm((p) => ({ ...p, andar: e.target.value }))}
                        placeholder="Andar"
                        className={cn("field-input", editForm.andar && "has-value")}
                      />
                    </div>
                    <input
                      type="text"
                      value={editForm.tipo}
                      onChange={(e) => setEditForm((p) => ({ ...p, tipo: e.target.value }))}
                      placeholder="Tipo"
                      className={cn("field-input", editForm.tipo && "has-value")}
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="flex-1 py-1.5 border border-[#e0e8e2] rounded-lg text-[12px] text-[#6b7280] flex items-center justify-center gap-1"
                      >
                        <X size={13} /> Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(local.id)}
                        className="flex-1 py-1.5 rounded-lg text-[12px] text-white flex items-center justify-center gap-1"
                        style={{ background: "var(--green-700)" }}
                      >
                        <Check size={13} /> Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="w-[36px] h-[36px] rounded-[9px] flex items-center justify-center shrink-0"
                      style={{ background: local.ativo ? "var(--green-50)" : "#f3f4f6", border: "1px solid var(--green-100)" }}>
                      <MapPin size={15} style={{ color: local.ativo ? "var(--green-600)" : "#9ca3af" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1a2e22]">{local.nome}</p>
                      <p className="text-[11px] text-[#9ca3af]">
                        {[local.bloco && `Bloco ${local.bloco}`, local.andar, local.tipo].filter(Boolean).join(" · ") || "Sem detalhes"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(local.id)
                          setEditForm({ nome: local.nome, bloco: local.bloco ?? "", andar: local.andar ?? "", tipo: local.tipo ?? "" })
                        }}
                        className="text-[#9ca3af] hover:text-[var(--green-700)] transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAtivo(local)}
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: local.ativo ? "var(--green-50)" : "#f3f4f6",
                          color:      local.ativo ? "var(--green-700)" : "#9ca3af",
                          border:     `1px solid ${local.ativo ? "var(--green-100)" : "#e5e7eb"}`,
                        }}
                      >
                        {local.ativo ? "Ativo" : "Inativo"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
