import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema, getZodIssues } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { createPasswordResetToken } from "@/lib/password-reset";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const limited = rateLimit(request, 5, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }
  try {
    const json = await request.json();
    const parsed = forgotPasswordSchema.parse(json);
    // Anti-enumeração: resposta idêntica exista ou não a conta.
    const user = await prisma.user.findUnique({
      where: { email: parsed.email },
      select: { id: true, anonymizedAt: true },
    });
    if (user && !user.anonymizedAt) {
      const token = await createPasswordResetToken(user.id);
      // Sem provedor de e-mail configurado, o token é logado em dev para
      // permitir o fluxo local. Configurar RESEND_API_KEY em produção.
      if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
        logger.warn("[forgot-password] sem RESEND_API_KEY — token de dev", { userId: user.id });
        return NextResponse.json({ ok: true, devToken: token });
      }
      logger.info("[forgot-password] token criado — envio pendente de provedor", { userId: user.id });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const issues = getZodIssues(e);
    if (issues) {
      return NextResponse.json({ error: "Dados inválidos", details: issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao solicitar redefinição" }, { status: 500 });
  }
}
