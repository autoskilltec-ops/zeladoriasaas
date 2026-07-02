"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Camera, X, Calendar, MapPin, User, Users, Plus, Trash2, Settings2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useInspecaoStore } from "@/store/inspecaoStore"
import type { Local, Usuario } from "@/types/app"

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ─── Zod schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  data_inspecao: z
    .string()
    .min(1, "Selecione a data da inspeção")
    .refine((v) => new Date(v + "T23:59:59") <= new Date(), {
      message: "A data não pode ser futura",
    }),
  local_id:     z.string().min(1, "Selecione o local"),
  inspetor_id:  z.string().min(1, "Selecione o responsável"),
  zelador_id:   z.string().min(1, "Selecione o profissional lotado"),
  descricao_visita: z.string().max(500, "Máximo 500 caracteres"),
  limpeza_programada: z.enum(["sim", "nao"]),
})

type FormValues = z.infer<typeof schema>

// ─── StepBar ──────────────────────────────────────────────────────────────────
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="step-bar" role="progressbar" aria-valuenow={current} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn("step-dot", {
            "step-dot-done":    i + 1 < current,
            "step-dot-current": i + 1 === current,
            "step-dot-pending": i + 1 > current,
          })}
        />
      ))}
      <span className="step-label">
        {current}/{total}
      </span>
    </div>
  )
}

// ─── FieldWrapper ─────────────────────────────────────────────────────────────
function FieldWrapper({
  label,
  required,
  error,
  charCount,
  charMax,
  icon,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  charCount?: number
  charMax?: number
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="field-label">
        {icon && <span className="text-[var(--green-600)]">{icon}</span>}
        {label}
        {required && <span className="req">*</span>}
        {charMax !== undefined && (
          <span className="ml-auto text-[10px] text-[#9ca3af] font-normal normal-case tracking-normal">
            {charCount ?? 0}/{charMax}
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-[11px] text-[#ef4444] flex items-center gap-1">
          <span aria-hidden>!</span> {error}
        </p>
      )}
    </div>
  )
}

// ─── PhotoSlot ────────────────────────────────────────────────────────────────
interface PhotoSlotProps {
  label:    string
  subtitle: string
  file:     File | null
  onChange: (f: File | null) => void
}

function PhotoSlot({ label, subtitle, file, onChange }: PhotoSlotProps) {
  const inputRef              = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const f = e.target.files?.[0] ?? null
    if (!f) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setError("Formato inválido. Use JPG, PNG ou WebP.")
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("Arquivo muito grande. Máximo 5 MB.")
      return
    }
    onChange(f)
    // reset value so same file can be re-selected
    e.target.value = ""
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  return (
    <div className="space-y-1">
      <div
        className={cn("photo-slot", file && "has-photo")}
        onClick={() => inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`${label}. ${file ? "Toque para trocar" : "Toque para adicionar foto"}`}
      >
        {preview ? (
          <>
            <img src={preview} alt={label} className="photo-preview" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[#1a2e22] truncate">{label}</p>
              <p className="text-[11px] text-[#6b7280] mt-0.5">Foto selecionada · toque para trocar</p>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#fee2e2] transition-colors hover:bg-[#fecaca]"
              aria-label={`Remover foto de ${label}`}
            >
              <X size={13} className="text-[#ef4444]" />
            </button>
          </>
        ) : (
          <>
            <div className="photo-icon-wrap">
              <Camera size={16} className="text-[var(--green-600)]" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[#374151]">{label}</p>
              <p className="photo-label mt-0.5">{subtitle}</p>
            </div>
          </>
        )}
      </div>
      {error && <p className="text-[11px] text-[#ef4444] pl-1">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={handleChange}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  )
}

// ─── LocalManager (admin) ──────────────────────────────────────────────────────
// Permite ao admin adicionar ou remover locais direto no step 1, sem sair do fluxo.
interface LocalManagerProps {
  locais:   Local[]
  orgId:    string | null
  onChange: (locais: Local[]) => void
}

function LocalManager({ locais, orgId, onChange }: LocalManagerProps) {
  const supabase = useRef(createClient()).current

  const [open,       setOpen]       = useState(false)
  const [showAdd,    setShowAdd]    = useState(false)
  const [form,       setForm]       = useState({ nome: "", bloco: "", andar: "" })
  const [saving,     setSaving]     = useState(false)
  const [formErr,    setFormErr]    = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function reload() {
    const { data, error } = await supabase
      .from("locais")
      .select("id, nome, bloco, andar, descricao")
      .eq("ativo", true)
      .order("nome")
    if (error) { console.error("Erro ao recarregar locais:", error); return }
    onChange(data ?? [])
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) { setFormErr("Informe o nome do local"); return }
    if (!orgId) { setFormErr("Não foi possível identificar sua organização"); return }

    setSaving(true)
    setFormErr(null)

    const { error } = await supabase
      .from("locais")
      .insert({
        nome:           form.nome.trim(),
        bloco:          form.bloco.trim() || null,
        andar:          form.andar.trim() || null,
        organizacao_id: orgId,
        ativo:          true,
      })

    if (error) {
      console.error("Erro ao adicionar local:", error)
      setSaving(false)
      setFormErr("Erro ao adicionar local: " + error.message)
      return
    }

    await reload()
    setSaving(false)
    setForm({ nome: "", bloco: "", andar: "" })
    setShowAdd(false)
  }

  async function handleRemove(id: string) {
    setRemovingId(id)
    const { error } = await supabase.from("locais").update({ ativo: false }).eq("id", id)
    if (error) {
      console.error("Erro ao remover local:", error)
      setFormErr("Erro ao remover local: " + error.message)
      setRemovingId(null)
      return
    }
    await reload()
    setRemovingId(null)
  }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-medium text-[var(--green-600)] hover:text-[var(--green-700)] flex items-center gap-1"
      >
        <Settings2 size={11} aria-hidden />
        {open ? "Fechar gerenciamento de locais" : "Gerenciar locais"}
      </button>

      {open && (
        <div className="mt-2 p-2.5 rounded-lg border border-[#e0e8e2] bg-[#f8faf9] space-y-2">
          {locais.length === 0 && (
            <p className="text-[11px] text-[#9ca3af]">Nenhum local cadastrado.</p>
          )}
          {locais.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 text-[12px] text-[#374151]">
              <span className="truncate">
                {l.nome}
                {l.bloco ? ` — ${l.bloco}` : ""}
                {l.andar ? ` / ${l.andar}` : ""}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(l.id)}
                disabled={removingId === l.id}
                className="shrink-0 text-[#ef4444] hover:text-[#b91c1c] disabled:opacity-50"
                aria-label={`Remover ${l.nome}`}
                title="Remover local"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {formErr && <p className="text-[11px] text-[#ef4444]">{formErr}</p>}

          {showAdd ? (
            <form onSubmit={handleAdd} className="pt-2 border-t border-[#e0e8e2] space-y-2">
              <input
                type="text"
                placeholder="Nome do local *"
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                className={cn("field-input", form.nome && "has-value")}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Bloco"
                  value={form.bloco}
                  onChange={(e) => setForm((p) => ({ ...p, bloco: e.target.value }))}
                  className={cn("field-input", form.bloco && "has-value")}
                />
                <input
                  type="text"
                  placeholder="Andar"
                  value={form.andar}
                  onChange={(e) => setForm((p) => ({ ...p, andar: e.target.value }))}
                  className={cn("field-input", form.andar && "has-value")}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setFormErr(null) }}
                  className="flex-1 py-1.5 rounded-lg border border-[#e0e8e2] text-[12px] text-[#6b7280]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-1.5 rounded-lg text-[12px] text-white"
                  style={{ background: "var(--green-700)" }}
                >
                  {saving ? "Salvando…" : "Adicionar"}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => { setShowAdd(true); setFormErr(null) }}
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-[var(--green-100)] text-[12px] text-[var(--green-700)]"
            >
              <Plus size={13} aria-hidden /> Novo local
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── InspetorManager (admin) ────────────────────────────────────────────────────
// Permite ao admin adicionar ou remover responsáveis (inspetores) direto no step 1.
interface InspetorManagerProps {
  inspetores:    Usuario[]
  currentUserId: string | null
  onChange:      (inspetores: Usuario[]) => void
}

function InspetorManager({ inspetores, currentUserId, onChange }: InspetorManagerProps) {
  const supabase = useRef(createClient()).current

  const [open,       setOpen]       = useState(false)
  const [showAdd,    setShowAdd]    = useState(false)
  const [form,       setForm]       = useState({ nome: "", email: "", senha: "" })
  const [saving,     setSaving]     = useState(false)
  const [formErr,    setFormErr]    = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function reload() {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nome, email, role, ativo")
      .in("role", ["admin", "inspetor"])
      .eq("ativo", true)
      .order("nome")
    if (error) { console.error("Erro ao recarregar responsáveis:", error); return }
    onChange(data ?? [])
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim() || !form.email.trim()) {
      setFormErr("Preencha nome e e-mail")
      return
    }
    if (form.senha.length < 8 || !/[a-zA-Z]/.test(form.senha) || !/[0-9]/.test(form.senha)) {
      setFormErr("Senha deve ter ao menos 8 caracteres com letras e números")
      return
    }

    setSaving(true)
    setFormErr(null)

    let res: Response
    try {
      res = await fetch("/api/admin/usuarios", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          nome:  form.nome.trim(),
          email: form.email.trim(),
          senha: form.senha,
          role:  "inspetor",
        }),
      })
    } catch (err) {
      console.error("Falha de rede ao adicionar responsável:", err)
      setSaving(false)
      setFormErr("Falha de conexão. Tente novamente.")
      return
    }

    const json = await res.json()

    if (!res.ok || json.error) {
      console.error("Erro ao adicionar responsável:", json.error)
      setSaving(false)
      setFormErr(json?.error?.message ?? "Erro ao adicionar responsável")
      return
    }

    await reload()
    setSaving(false)
    setForm({ nome: "", email: "", senha: "" })
    setShowAdd(false)
  }

  async function handleRemove(id: string) {
    if (id === currentUserId) return
    setRemovingId(id)
    const { error } = await supabase.from("usuarios").update({ ativo: false }).eq("id", id)
    if (error) {
      console.error("Erro ao remover responsável:", error)
      setFormErr("Erro ao remover responsável: " + error.message)
      setRemovingId(null)
      return
    }
    await reload()
    setRemovingId(null)
  }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-medium text-[var(--green-600)] hover:text-[var(--green-700)] flex items-center gap-1"
      >
        <Settings2 size={11} aria-hidden />
        {open ? "Fechar gerenciamento de responsáveis" : "Gerenciar responsáveis"}
      </button>

      {open && (
        <div className="mt-2 p-2.5 rounded-lg border border-[#e0e8e2] bg-[#f8faf9] space-y-2">
          {inspetores.length === 0 && (
            <p className="text-[11px] text-[#9ca3af]">Nenhum responsável cadastrado.</p>
          )}
          {inspetores.map((u) => {
            const isSelf = u.id === currentUserId
            return (
              <div key={u.id} className="flex items-center justify-between gap-2 text-[12px] text-[#374151]">
                <span className="truncate">{u.nome}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(u.id)}
                  disabled={removingId === u.id || isSelf}
                  className="shrink-0 text-[#ef4444] hover:text-[#b91c1c] disabled:opacity-50 disabled:hover:text-[#ef4444]"
                  aria-label={`Remover ${u.nome}`}
                  title={isSelf ? "Você não pode remover a si mesmo" : "Remover responsável"}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}

          {formErr && <p className="text-[11px] text-[#ef4444]">{formErr}</p>}

          {showAdd ? (
            <form onSubmit={handleAdd} className="pt-2 border-t border-[#e0e8e2] space-y-2">
              <input
                type="text"
                placeholder="Nome *"
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                className={cn("field-input", form.nome && "has-value")}
              />
              <input
                type="email"
                placeholder="E-mail *"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className={cn("field-input", form.email && "has-value")}
              />
              <input
                type="password"
                placeholder="Senha inicial *"
                value={form.senha}
                onChange={(e) => setForm((p) => ({ ...p, senha: e.target.value }))}
                className={cn("field-input", form.senha && "has-value")}
              />
              <p className="text-[10px] text-[#9ca3af]">Mínimo 8 caracteres, com letras e números.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setFormErr(null) }}
                  className="flex-1 py-1.5 rounded-lg border border-[#e0e8e2] text-[12px] text-[#6b7280]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-1.5 rounded-lg text-[12px] text-white"
                  style={{ background: "var(--green-700)" }}
                >
                  {saving ? "Salvando…" : "Adicionar"}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => { setShowAdd(true); setFormErr(null) }}
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-[var(--green-100)] text-[12px] text-[var(--green-700)]"
            >
              <Plus size={13} aria-hidden /> Novo responsável
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NovaInspecaoPage() {
  const router   = useRouter()
  const supabase = useRef(createClient()).current

  const { setDados, setInspecaoId } = useInspecaoStore()

  const [locais,           setLocais]           = useState<Local[]>([])
  const [inspetores,       setInspetores]       = useState<Usuario[]>([])
  const [zeladores,        setZeladores]        = useState<Usuario[]>([])
  const [loadingZeladores, setLoadingZeladores] = useState(false)
  const [submitError,      setSubmitError]      = useState<string | null>(null)
  const [isAdmin,          setIsAdmin]          = useState(false)
  const [orgId,            setOrgId]            = useState<string | null>(null)
  const [currentUserId,    setCurrentUserId]    = useState<string | null>(null)
  const [photos, setPhotos] = useState<{
    situacao: File | null
    final:    File | null
  }>({ situacao: null, final: null })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      data_inspecao:      todayISO(),
      limpeza_programada: "nao",
      local_id:           "",
      inspetor_id:        "",
      zelador_id:         "",
      descricao_visita:   "",
    },
  })

  const localId           = watch("local_id")
  const limpezaProgramada = watch("limpeza_programada")
  const descricao         = watch("descricao_visita") ?? ""

  // ── Carrega locais e inspetores na montagem ──────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()

      const [
        { data: locaisData },
        { data: inspetoresData },
        profileResult,
      ] = await Promise.all([
        supabase
          .from("locais")
          .select("id, nome, bloco, andar, descricao")
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("usuarios")
          .select("id, nome, email, role, ativo")
          .in("role", ["admin", "inspetor"])
          .eq("ativo", true)
          .order("nome"),
        user
          ? supabase.from("usuarios").select("role, organizacao_id").eq("id", user.id).single()
          : Promise.resolve({ data: null }),
      ])

      setLocais(locaisData ?? [])
      setInspetores(inspetoresData ?? [])
      if (user) {
        setValue("inspetor_id", user.id)
        setCurrentUserId(user.id)
      }
      if (profileResult.data) {
        setIsAdmin(profileResult.data.role === "admin")
        setOrgId(profileResult.data.organizacao_id)
      }
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carrega zeladores quando o local muda ────────────────────────────────
  useEffect(() => {
    if (!localId) {
      setZeladores([])
      return
    }

    setLoadingZeladores(true)
    setValue("zelador_id", "")

    supabase
      .from("local_zeladores")
      .select("usuarios!inner(id, nome, email, role, ativo)")
      .eq("local_id", localId)
      .eq("ativo", true)
      .then(({ data }) => {
        const users = (data ?? [])
          .map((row: any) => row.usuarios as Usuario)
          .filter(Boolean)
        setZeladores(users)
        setLoadingZeladores(false)
      }, () => {
        setLoadingZeladores(false)
      })
  }, [localId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit ───────────────────────────────────────────────────────────────
  async function onSubmit(values: FormValues) {
    setSubmitError(null)

    let res: Response
    try {
      res = await fetch("/api/inspecoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
    } catch {
      setSubmitError("Falha de conexão. Verifique sua internet e tente novamente.")
      return
    }

    const json = await res.json()

    if (!res.ok) {
      setSubmitError(json?.error ?? "Erro ao criar inspeção. Tente novamente.")
      return
    }

    const inspecaoId: string | undefined = json.data?.inspecao_id
    if (!inspecaoId) {
      setSubmitError("Resposta inesperada do servidor.")
      return
    }

    // Persiste no store Zustand para os steps seguintes
    setDados(values)
    setInspecaoId(inspecaoId)

    router.push(`/inspecao/${inspecaoId}/avaliacao`)
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Barra de progresso dos steps */}
      <StepBar current={1} total={7} />

      <div className="px-4 pt-4 pb-2">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>

          {/* ── Card: Dados da visita ──────────────────────────────────── */}
          <div className="card mb-3">
            <p className="card-title">
              <Calendar size={13} aria-hidden />
              Dados da visita
            </p>

            <div className="space-y-4">

              {/* Data da inspeção */}
              <FieldWrapper
                label="Data da inspeção"
                required
                error={errors.data_inspecao?.message}
                icon={<Calendar size={11} />}
              >
                <input
                  type="date"
                  max={todayISO()}
                  className={cn(
                    "field-input",
                    errors.data_inspecao && "!border-[#ef4444] !bg-[#fef2f2]"
                  )}
                  {...register("data_inspecao")}
                />
              </FieldWrapper>

              {/* Local */}
              <FieldWrapper
                label="Local"
                required
                error={errors.local_id?.message}
                icon={<MapPin size={11} />}
              >
                <select
                  className={cn(
                    "field-input",
                    localId && "has-value",
                    errors.local_id && "!border-[#ef4444] !bg-[#fef2f2]"
                  )}
                  {...register("local_id")}
                >
                  <option value="">Selecione o local</option>
                  {locais.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                      {l.bloco ? ` — ${l.bloco}` : ""}
                      {l.andar ? ` / ${l.andar}` : ""}
                    </option>
                  ))}
                </select>
                {isAdmin && <LocalManager locais={locais} orgId={orgId} onChange={setLocais} />}
              </FieldWrapper>

              {/* Responsável pela inspeção */}
              <FieldWrapper
                label="Responsável pela inspeção"
                required
                error={errors.inspetor_id?.message}
                icon={<User size={11} />}
              >
                <select
                  className={cn(
                    "field-input",
                    watch("inspetor_id") && "has-value",
                    errors.inspetor_id && "!border-[#ef4444] !bg-[#fef2f2]"
                  )}
                  {...register("inspetor_id")}
                >
                  <option value="">Selecione o responsável</option>
                  {inspetores.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
                {isAdmin && (
                  <InspetorManager
                    inspetores={inspetores}
                    currentUserId={currentUserId}
                    onChange={setInspetores}
                  />
                )}
              </FieldWrapper>

              {/* Profissional lotado no local */}
              <FieldWrapper
                label="Profissional lotado no local"
                required
                error={errors.zelador_id?.message}
                icon={<Users size={11} />}
              >
                <select
                  className={cn(
                    "field-input",
                    watch("zelador_id") && "has-value",
                    errors.zelador_id && "!border-[#ef4444] !bg-[#fef2f2]",
                    (!localId || loadingZeladores) && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={!localId || loadingZeladores}
                  {...register("zelador_id")}
                >
                  <option value="">
                    {!localId
                      ? "Selecione o local primeiro"
                      : loadingZeladores
                        ? "Carregando profissionais…"
                        : zeladores.length === 0
                          ? "Nenhum profissional cadastrado"
                          : "Selecione o profissional"}
                  </option>
                  {zeladores.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </FieldWrapper>

              {/* Descrição da visita */}
              <FieldWrapper
                label="Descrição da visita"
                error={errors.descricao_visita?.message}
                charCount={descricao.length}
                charMax={500}
              >
                <textarea
                  rows={3}
                  placeholder="Descreva brevemente o objetivo ou contexto da visita (opcional)"
                  className={cn(
                    "field-input h-auto py-[9px] resize-none leading-[1.5]",
                    descricao.length > 0 && "has-value",
                    errors.descricao_visita && "!border-[#ef4444] !bg-[#fef2f2]"
                  )}
                  {...register("descricao_visita")}
                />
              </FieldWrapper>

              {/* Limpeza programada */}
              <div>
                <p className="field-label mb-2">
                  Precisa de limpeza programada?
                  <span className="req">*</span>
                </p>
                <div className="toggle-group">
                  {(["nao", "sim"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={cn("toggle-btn", limpezaProgramada === v && "active")}
                      onClick={() =>
                        setValue("limpeza_programada", v, { shouldValidate: true })
                      }
                      aria-pressed={limpezaProgramada === v}
                    >
                      {v === "nao" ? "Não" : "Sim"}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* ── Card: Fotos ───────────────────────────────────────────── */}
          <div className="card mb-4">
            <p className="card-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                <circle cx="12" cy="13" r="3"/>
              </svg>
              Fotos
              <span className="normal-case text-[10px] font-normal text-[#9ca3af] tracking-normal">
                — opcional
              </span>
            </p>

            <div className="space-y-2.5">
              <PhotoSlot
                label="Situação encontrada"
                subtitle="Foto da condição no momento da chegada"
                file={photos.situacao}
                onChange={(f) => setPhotos((p) => ({ ...p, situacao: f }))}
              />
              <PhotoSlot
                label="Foto final"
                subtitle="Estado do ambiente ao encerrar a visita"
                file={photos.final}
                onChange={(f) => setPhotos((p) => ({ ...p, final: f }))}
              />
            </div>
          </div>

          {/* ── Erro de envio ────────────────────────────────────────── */}
          {submitError && (
            <div
              role="alert"
              className="mb-3 px-3 py-2.5 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[12px] text-[#b91c1c]"
            >
              {submitError}
            </div>
          )}

          {/* ── Botão avançar ─────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary mb-2"
          >
            {isSubmitting ? (
              <>
                <span
                  className="inline-block w-[15px] h-[15px] border-2 border-white border-t-transparent rounded-full animate-spin"
                  aria-hidden
                />
                Salvando…
              </>
            ) : (
              "Próximo: Avaliação de Limpeza →"
            )}
          </button>

        </form>
      </div>
    </div>
  )
}
