"use client"

import { useState } from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { ChevronDown, Trash2, Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface EditableSelectOption {
  id:    string
  label: string
}

interface EditableSelectProps {
  value:              string
  onChange:           (id: string) => void
  options:            EditableSelectOption[]
  placeholder:        string
  addPlaceholder:     string
  emptyText:          string
  canManage:          boolean
  disabled?:          boolean
  hasError?:          boolean
  disabledRemoveIds?: string[]
  onAdd:              (nome: string) => Promise<{ id: string }>
  onRemove:           (id: string) => Promise<void>
}

// ─── EditableSelect ─────────────────────────────────────────────────────────
// Dropdown com adicionar/remover embutidos na própria lista — usado quando o
// admin precisa manter um catálogo curto (locais, responsáveis) sem sair do fluxo.
export function EditableSelect({
  value,
  onChange,
  options,
  placeholder,
  addPlaceholder,
  emptyText,
  canManage,
  disabled,
  hasError,
  disabledRemoveIds,
  onAdd,
  onRemove,
}: EditableSelectProps) {
  const [open,       setOpen]       = useState(false)
  const [addValue,   setAddValue]   = useState("")
  const [adding,     setAdding]     = useState(false)
  const [addError,   setAddError]   = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const selected = options.find((o) => o.id === value)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const nome = addValue.trim()
    if (!nome || adding) return

    setAdding(true)
    setAddError(null)
    try {
      const created = await onAdd(nome)
      onChange(created.id)
      setAddValue("")
      setOpen(false)
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Erro ao adicionar")
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id)
    setAddError(null)
    try {
      await onRemove(id)
      if (value === id) onChange("")
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Erro ao remover")
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) { setAddError(null); setAddValue("") }
      }}
    >
      <PopoverPrimitive.Trigger
        disabled={disabled}
        className={cn(
          "field-input flex items-center justify-between gap-2 text-left cursor-pointer",
          value && "has-value",
          hasError && "!border-[#ef4444] !bg-[#fef2f2]"
        )}
      >
        <span className={cn("truncate", !selected && "text-[#9ca3af]")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={cn("shrink-0 text-[#9ca3af] transition-transform duration-150", open && "rotate-180")}
          aria-hidden
        />
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          align="start"
          sideOffset={4}
          className="z-50"
          style={{ width: "var(--anchor-width)" }}
        >
          <PopoverPrimitive.Popup className="flex flex-col rounded-lg border border-[var(--line)] bg-white shadow-[var(--shadow-card)] overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="max-h-[168px] overflow-y-auto py-1">
              {options.length === 0 && (
                <p className="px-3 py-2.5 text-[12px] text-[#9ca3af]">{emptyText}</p>
              )}
              {options.map((opt) => (
                <div key={opt.id} className="flex items-center gap-0.5 px-1">
                  <button
                    type="button"
                    onClick={() => { onChange(opt.id); setOpen(false) }}
                    className={cn(
                      "flex-1 min-w-0 text-left px-2 py-2 rounded-md text-[13px] truncate transition-colors",
                      opt.id === value
                        ? "bg-[var(--sage-100)] text-[var(--forest-700)] font-medium"
                        : "text-[#1a2e22] hover:bg-[#f4f6f4]"
                    )}
                  >
                    {opt.label}
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleRemove(opt.id)}
                      disabled={removingId === opt.id || disabledRemoveIds?.includes(opt.id)}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-[#c1c9c4] hover:text-[#ef4444] hover:bg-[#fee2e2] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#c1c9c4] transition-colors"
                      aria-label={`Remover ${opt.label}`}
                      title={disabledRemoveIds?.includes(opt.id) ? "Você não pode remover a si mesmo" : "Remover"}
                    >
                      {removingId === opt.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Trash2 size={12} />}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {canManage && (
              <div className="border-t border-[var(--line)] bg-[#f8faf9]">
                <form onSubmit={handleAdd} className="flex items-center gap-1.5 p-1.5">
                  <input
                    type="text"
                    value={addValue}
                    onChange={(e) => setAddValue(e.target.value)}
                    placeholder={addPlaceholder}
                    className="flex-1 min-w-0 h-8 px-2.5 rounded-md border border-[var(--line)] bg-white text-[12px] focus:outline-none focus:border-[var(--forest-600)]"
                  />
                  <button
                    type="submit"
                    disabled={adding || !addValue.trim()}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-white disabled:opacity-40 transition-opacity"
                    style={{ background: "var(--forest-700)" }}
                    aria-label="Adicionar"
                  >
                    {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  </button>
                </form>
                {addError && (
                  <p className="px-2.5 pb-2 text-[11px] text-[#ef4444]">{addError}</p>
                )}
              </div>
            )}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
