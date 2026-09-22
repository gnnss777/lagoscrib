import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeCron } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

/**
 * Retenção LGPD: purga tokens de reset expirados e pedidos de remoção
 * resolvidos há > 90 dias. Proteger com CRON_SECRET (ou allowlist/IP).
 */
export async function GET(request: Request) {
  return runWithAuth(request);
}

export async function POST(request: Request) {
  return runWithAuth(request);
}

async function runWithAuth(request: Request) {
  const authError = await authorizeCron(request);
  if (authError) return authError;
  try {
    const now = new Date();
    const [resetTokens, removals] = await Promise.all([
      prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.removalRequest.deleteMany({
        where: { status: "resolvida", resolvedAt: { lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } },
      }),
    ]);
    logger.info("[retention] purge executado", {
      resetTokens: resetTokens.count,
      removals: removals.count,
    });
    return NextResponse.json({ ok: true, resetTokens: resetTokens.count, removals: removals.count });
  } catch (e) {
    logger.error("[retention] falha no purge", undefined, e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
