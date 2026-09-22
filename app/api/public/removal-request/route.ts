import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { removalRequestSchema, getZodIssues } from "@/lib/validation";
import { logger } from "@/lib/logger";

/**
 * Pedido de remoção de anúncio por anunciante (direito de eliminação,
 * LGPD art. 18, VI). Rota pública com rate limit apertado; triagem humana
 * (status pendente → resolvida). Sem dado pessoal obrigatório.
 */
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
    const parsed = removalRequestSchema.parse(json);
    const created = await prisma.removalRequest.create({
      data: {
        externalId: parsed.externalId,
        portal: parsed.portal,
        reason: parsed.reason ?? null,
        contactHint: parsed.contactHint ?? null,
      },
      select: { id: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (e) {
    const issues = getZodIssues(e);
    if (issues) {
      return NextResponse.json({ error: "Dados inválidos", details: issues }, { status: 400 });
    }
    logger.error("[removal-request] 500", undefined, e);
    return NextResponse.json({ error: "Erro ao registrar pedido" }, { status: 500 });
  }
}
