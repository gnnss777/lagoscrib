import { NextResponse } from "next/server";

/**
 * Informa se o backend (DB + NextAuth) está configurado. Sem backend, o app
 * roda em modo legado local (apenas dev). Sem segredos na resposta.
 */
export async function GET() {
  const backend = Boolean(process.env.DATABASE_URL && process.env.NEXTAUTH_SECRET);
  return NextResponse.json({ backend });
}
