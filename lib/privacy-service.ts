import { prisma } from "./prisma";
import { logger } from "./logger";
import { ANONYMIZED_NAME, POLICY_CONSENT_SCOPE, PRIVACY_POLICY_VERSION } from "./privacy";

/**
 * Registra o aceite da Política de Privacidade (LGPD art. 7º) de forma
 * idempotente, gravando também a versão vigente da política.
 */
export async function recordPolicyConsent(userId: string, policyVersion: string) {
  await recordConsent(userId, POLICY_CONSENT_SCOPE, policyVersion);
}

/**
 * Registra um consentimento por escopo (LGPD art. 8º) de forma idempotente.
 * Resiliente a duplo-toque (P2002 → update). Padrão do app `só`.
 */
export async function recordConsent(userId: string, scope: string, version: string) {
  try {
    await prisma.privacyConsent.upsert({
      where: { userId_scope: { userId, scope } },
      update: { acceptedAt: new Date(), policyVersion: version },
      create: { userId, scope, policyVersion: version },
    });
  } catch (e) {
    if ((e as { code?: string }).code !== "P2002") throw e;
    await prisma.privacyConsent.update({
      where: { userId_scope: { userId, scope } },
      data: { acceptedAt: new Date(), policyVersion: version },
    });
  }
  await prisma.privacyAuditLog.create({
    data: { userId, action: "CONSENT", detail: `${scope} v${version}` },
  });
}

/**
 * Monta o pacote de dados pessoais do titular para exportação (LGPD art. 18,
 * II). Nunca inclui senha. Montado on-the-fly (nada persistido em arquivo).
 */
export async function buildUserDataPackage(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      properties: { include: { followUps: true, notes: true } },
      consents: true,
    },
  });
  if (!user) throw new Error("Usuário não encontrado");

  const { password: _password, ...safe } = user;
  return {
    exportedAt: new Date().toISOString(),
    policyVersion: PRIVACY_POLICY_VERSION,
    data: safe,
  };
}

/**
 * Anonimiza todos os dados pessoais do usuário (LGPD art. 18, VI — direito
 * ao esquecimento). Imóveis salvos/follow-ups/notas são removidos em cascata
 * (dados do próprio titular, sem retenção legal). Auditoria preservada com
 * userId nulo (SetNull) para trilha sem PII.
 */
export async function anonymizeUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw new Error("Usuário não encontrado");

  const anonEmail = `deleted_${userId}@invalid.local`;

  await prisma.$transaction(async (tx) => {
    await tx.followUp.deleteMany({ where: { userId } });
    await tx.note.deleteMany({ where: { userId } });
    await tx.savedProperty.deleteMany({ where: { userId } });
    await tx.privacyConsent.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        name: ANONYMIZED_NAME,
        email: anonEmail,
        password: "!",
        anonymizedAt: new Date(),
      },
    });
    await tx.privacyAuditLog.create({ data: { userId, action: "ANONYMIZE" } });
  });

  return { ok: true };
}
