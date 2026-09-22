/**
 * Sanitiza o parâmetro `next` usado em redirects pós-login. Só aceita caminhos
 * absolutos do próprio app — rejeita URLs externas, protocol-relative
 * (//evil.com) e backslash (\evil.com é tratado como //evil.com por browsers,
 * burlando o filtro de prefixo). Módulo client-safe (sem imports de servidor).
 * Padrão reaproveitado do app `só` (src/lib/sanitize.ts).
 */
export function sanitizeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  if (next.includes("\\")) return null;
  return next;
}
