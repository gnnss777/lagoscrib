import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { applySecurityHeaders } from "@/lib/security-headers";

/**
 * Proxy global (padrão Next 16 vigente, igual ao app `só`): injeta headers de
 * segurança em TODAS as respostas (CSP com nonce, COOP/CORP, noindex) +
 * x-request-id para correlação de logs. Não faz gate de sessão: a home (/)
 * faz gate client-side (LoginPage) e as rotas de API se protegem via
 * requireAuth (lib/api-auth.ts).
 */
export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID();
  const requestId = crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  applySecurityHeaders(response.headers, nonce);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
