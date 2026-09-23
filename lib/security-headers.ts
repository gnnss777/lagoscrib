/**
 * Builders puros dos headers de segurança aplicados pelo middleware.
 * Funções puras para permitir teste unitário sem o edge runtime.
 * Padrão reaproveitado do app `só` (src/lib/proxy.ts), simplificado:
 * sem roteamento por host (store/staff/kiosk) — app privado, tudo noindex.
 */

export function buildCsp(nonce: string): string {
  // Nonce não funciona aqui: a home é estaticamente prerenderizada (○ no build),
  // então o HTML não carrega o nonce por request e os inline scripts do Next
  // (hidratação) eram bloqueados -> página em branco (React #412).
  // 'unsafe-inline' em script-src é o padrão p/ App Router sem SSR-nonce;
  // as outras diretivas continuam bloqueando origens externas e plugins.
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://va.vercel-analytics.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://va.vercel-analytics.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  return directives.join("; ");
}

export function applySecurityHeaders(headers: Headers, nonce: string): void {
  headers.set("Content-Security-Policy", buildCsp(nonce));
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  // App privado (login obrigatório): nada indexável — defense-in-depth.
  headers.set("X-Robots-Tag", "noindex, nofollow");
}
