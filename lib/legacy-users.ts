/**
 * Credenciais do modo legado local: um único par usuário/senha, sem banco.
 *
 * Só o SERVIDOR lê isto, para o `authorize` do NextAuth (`lib/auth.ts`) validar a
 * senha e assinar a sessão. Nada no cliente importa este módulo — o `AppContext`
 * decide se está autenticado pela sessão, nunca comparando senha no browser.
 *
 * Por isso os nomes NÃO têm o prefixo `NEXT_PUBLIC_`: com ele, o Next.js embute
 * o valor no bundle do cliente e qualquer pessoa que abrir o site lê a senha no
 * JavaScript. Renomear de volta quebra a segurança sem quebrar a tela — nenhum
 * componente precisa do valor, só a sessão.
 *
 * Fail-closed: sem usuário E senha configurados, o mapa fica vazio e ninguém
 * entra — inclusive com string vazia.
 */
export function buildLegacyUsers(): Record<string, string> {
  const isDev = process.env.NODE_ENV !== "production";
  const user = (process.env.APP_USER ?? (isDev ? "guinness" : "")).toLowerCase();
  const pass = process.env.APP_PASS ?? (isDev ? "curitiba2026" : "");
  const users: Record<string, string> = {};
  if (user && pass) users[user] = pass;
  return users;
}
