import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { auth, signOut } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { anonymizeUser } from "@/lib/privacy-service";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const limited = rateLimit(request, 5, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }
  try {
    const json = await request.json().catch(() => ({}));
    const full = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true, anonymizedAt: true },
    });
    if (!full) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    if (full.anonymizedAt) {
      return NextResponse.json({ error: "Conta já anonimizada" }, { status: 400 });
    }
    const currentPassword = typeof json?.currentPassword === "string" ? json.currentPassword : "";
    const valid = await compare(currentPassword, full.password);
    if (!valid) {
      return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
    }

    await anonymizeUser(session.user.id);
    await signOut({ redirect: false });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.warn("[privacy/anonymize] falha ao anonimizar conta", { userId: session.user.id }, e);
    return NextResponse.json({ error: "Não foi possível excluir a conta" }, { status: 500 });
  }
}
