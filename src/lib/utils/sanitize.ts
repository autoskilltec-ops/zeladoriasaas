// Sanitização de inputs — camada de defesa server-side
// React já escapa HTML no render, mas sanitizamos na entrada para
// garantir que dados limpos cheguem ao banco.

/** Remove tags HTML e caracteres de controle. Uso geral em campos de texto. */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")           // remove tags HTML
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // chars de controle
    .trim()
    .substring(0, 2000)
}

/** Versão mais restrita para campos curtos (nome, título, etc.). Limite 255. */
export function sanitizeShort(input: string): string {
  return sanitizeText(input).substring(0, 255)
}

/** Valida UUID v4 — previne injeção via parâmetros de rota. */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/** Sanitiza nome de arquivo — previne path traversal. */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, "_")            // sem ".."
    .substring(0, 100)
}
