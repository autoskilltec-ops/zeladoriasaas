import { supabaseAdmin } from "@/lib/supabase/admin"
import type { NextRequest } from "next/server"

export type AuditAction =
  | "org.criar"
  | "inspecao.criar"
  | "inspecao.finalizar"
  | "inspecao.cancelar"
  | "nc.criar"
  | "nc.resolver"
  | "usuario.criar"
  | "usuario.deletar"
  | "usuario.desativar"

interface AuditParams {
  user_id:        string
  organizacao_id: string
  action:         AuditAction
  resource_id?:   string
  request?:       NextRequest
  metadata?:      Record<string, unknown>
}

/**
 * Registra uma ação crítica na tabela audit_logs via service role.
 * Nunca lança exceção — falha silenciosamente para não bloquear a operação principal.
 */
export async function auditLog(params: AuditParams): Promise<void> {
  try {
    const ip = params.request
      ? (params.request.headers.get("x-forwarded-for")?.split(",")[0].trim()
        ?? params.request.headers.get("x-real-ip")
        ?? null)
      : null

    const user_agent = params.request?.headers.get("user-agent") ?? null

    await supabaseAdmin.from("audit_logs").insert({
      user_id:        params.user_id,
      organizacao_id: params.organizacao_id,
      action:         params.action,
      resource_id:    params.resource_id ?? null,
      ip_address:     ip,
      user_agent,
      metadata:       params.metadata ?? null,
    })
  } catch {
    // Intencional: audit log nunca bloqueia a operação principal
  }
}
