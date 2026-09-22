import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { registerUserSchema, getZodIssues } from "@/lib/validation";
import { isDisposableEmail } from "@/lib/disposable-email";
import { rateLimit } from "@/lib/rate-limit";
import { recordPolicyConsent } from "@/lib/privacy-service";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";
import { logger } from "@/lib/logger";

const userSafeSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

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
    const parsed = registerUserSchema.parse(json);
    if (await isDisposableEmail(parsed.email)) {
      return NextResponse.json(
        {
          error: "Dados inválidos",
          details: [{ path: ["email"], message: "E-mail temporário não é aceito. Use um e-mail válido." }],
        },
        { status: 400 },
      );
    }
    const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
    if (existing) {
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
    }
    const user = await prisma.user.create({
      data: {
        name: parsed.name,
        email: parsed.email,
        password: await hash(parsed.password, 10),
      },
      select: userSafeSelect,
    });
    try {
      await recordPolicyConsent(user.id, PRIVACY_POLICY_VERSION);
    } catch (e) {
      logger.error("Falha ao registrar consentimento da política", { userId: user.id }, e);
    }
    await prisma.privacyAuditLog.create({
      data: { userId: user.id, action: "REGISTER" },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e) {
    const issues = getZodIssues(e);
    if (issues) {
      return NextResponse.json({ error: "Dados inválidos", details: issues }, { status: 400 });
    }
    logger.error("[register] 500", undefined, e);
    return NextResponse.json({ error: "Erro ao criar conta" }, { status: 500 });
  }
}
