import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { buildUserDataPackage } from "@/lib/privacy-service";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const limited = rateLimit(request, 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }
  try {
    const pkg = await buildUserDataPackage(session.user.id);
    await prisma.privacyAuditLog.create({
      data: { userId: session.user.id, action: "EXPORT" },
    });
    return NextResponse.json(pkg, {
      headers: {
        "Content-Disposition": `attachment; filename="meus-dados-${session.user.id}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    logger.warn("[privacy/export] falha ao exportar dados", { userId: session.user.id }, e);
    return NextResponse.json({ error: "Não foi possível exportar os dados" }, { status: 500 });
  }
}
