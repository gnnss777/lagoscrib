import { NextResponse } from "next/server";
import { buildLegacyUsers } from "@/lib/legacy-users";
import { getDatabaseUrl } from "@/lib/db-url";

/**
 * Informa qual login o app deve oferecer.
 *
 * - `comBanco`: existe Postgres, então o usuário é uma linha de `User` e o
 *   identificador é e-mail (o input valida formato).
 * - `comLegado`: sem banco, o par único de lib/legacy-users.ts, cujo
 *   identificador é um usuário qualquer ("guinness"), não um e-mail. Validar
 *   formato de e-mail aí impede justamente quem vai entrar.
 * - `backend`: dá para assinar sessão do NextAuth (o que libera as rotas /api/*).
 *
 * Sem segredos na resposta.
 */
export async function GET() {
  const comBanco = Boolean(getDatabaseUrl());
  const comLegado = Object.keys(buildLegacyUsers()).length > 0;
  const backend = Boolean(process.env.NEXTAUTH_SECRET) && (comBanco || comLegado);
  return NextResponse.json({ backend, comBanco, comLegado });
}
