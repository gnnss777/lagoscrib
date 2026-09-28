/**
 * Credenciais do modo legado local: um único par usuário/senha, sem banco.
 *
 * Usado em dois lugares que precisam concordar:
 * - o login client-side (lib/AppContext.tsx), que decide se mostra o Dashboard;
 * - o authorize do NextAuth (lib/auth.ts), que valida a senha de verdade e
 *   assina o cookie de sessão para as rotas /api/*.
 *
 * AVISO DE SEGURANÇA — leia antes de confiar nisso como autenticação:
 * NEXT_PUBLIC_APP_USER / NEXT_PUBLIC_APP_PASS são variáveis NEXT_PUBLIC_, então
 * o Next.js as embute no bundle do cliente. Qualquer pessoa que abrir o site
 * lê o usuário e a senha no JavaScript. Este modo serve para rodar o app em
 * uma máquina só, não para proteger dado de verdade. Para auth real é preciso
 * um Postgres (o `authorize` já tem o caminho pronto) e estas duas variáveis
 * precisam sair do lado público.
 *
 * Fail-closed: sem usuário E senha configurados, o mapa fica vazio e ninguém
 * entra — inclusive com string vazia.
 */
export function buildLegacyUsers(): Record<string, string> {
  const isDev = process.env.NODE_ENV !== "production";
  const user = (process.env.NEXT_PUBLIC_APP_USER ?? (isDev ? "guinness" : "")).toLowerCase();
  const pass = process.env.NEXT_PUBLIC_APP_PASS ?? (isDev ? "curitiba2026" : "");
  const users: Record<string, string> = {};
  if (user && pass) users[user] = pass;
  return users;
}
