import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { resetPasswordSchema, getZodIssues } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { consumePasswordResetToken } from "@/lib/password-reset";

export async function POST(request: Request) {
  const limited = rateLimit(request, 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }
  try {
    const json = await request.json();
    const parsed = resetPasswordSchema.parse(json);
    const result = await consumePasswordResetToken(parsed.token);
    if (!result.ok) {
      return NextResponse.json({ error: "Token inválido ou expirado" }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: result.userId },
      data: { password: await hash(parsed.password, 10) },
    });
    await prisma.privacyAuditLog.create({
      data: { userId: result.userId, action: "PASSWORD_RESET" },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const issues = getZodIssues(e);
    if (issues) {
      return NextResponse.json({ error: "Dados inválidos", details: issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao redefinir senha" }, { status: 500 });
  }
}
