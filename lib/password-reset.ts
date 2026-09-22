import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";
import { logger } from "./logger";

export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({
      where: { userId, usedAt: null },
    }),
    prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
      },
    }),
  ]);

  logger.info("[password-reset] token de redefinição criado", { userId });
  return token;
}

export type ConsumeResetTokenResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

export async function consumePasswordResetToken(token: string): Promise<ConsumeResetTokenResult> {
  const tokenHash = hashResetToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record) return { ok: false, reason: "invalid" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const updated = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (updated.count !== 1) return { ok: false, reason: "used" };

  return { ok: true, userId: record.userId };
}
