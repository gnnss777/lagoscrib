import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { syncPushSchema, getZodIssues } from "@/lib/validation";
import { logger } from "@/lib/logger";

/**
 * Migra o estado local (localStorage) para o banco na primeira sessão com
 * backend. Upserts idempotentes por (userId, externalId, portal) — isolamento
 * por usuário em todas as escritas (anti-IDOR).
 */
export async function POST(request: Request) {
  const { error, session } = await requireAuth(request);
  if (error) return error;
  const userId = session!.user.id;

  try {
    const json = await request.json();
    const parsed = syncPushSchema.parse(json);

    let upserted = 0;
    for (const s of parsed.statuses) {
      const property = await prisma.savedProperty.upsert({
        where: {
          userId_externalId_portal: { userId, externalId: s.apartmentId, portal: s.portal },
        },
        update: { status: s.status, urlOriginal: s.urlOriginal || undefined },
        create: {
          userId,
          externalId: s.apartmentId,
          portal: s.portal,
          urlOriginal: s.urlOriginal,
          status: s.status,
        },
        select: { id: true },
      });
      upserted++;
      void property;
    }
    for (const n of parsed.notes) {
      const property = await prisma.savedProperty.upsert({
        where: {
          userId_externalId_portal: { userId, externalId: n.apartmentId, portal: n.portal },
        },
        update: { urlOriginal: n.urlOriginal || undefined },
        create: { userId, externalId: n.apartmentId, portal: n.portal, urlOriginal: n.urlOriginal },
        select: { id: true },
      });
      await prisma.note.create({
        data: { userId, propertyId: property.id, text: n.text },
      });
      upserted++;
    }
    for (const f of parsed.followUps) {
      const property = await prisma.savedProperty.upsert({
        where: {
          userId_externalId_portal: { userId, externalId: f.apartmentId, portal: f.portal },
        },
        update: { urlOriginal: f.urlOriginal || undefined },
        create: { userId, externalId: f.apartmentId, portal: f.portal, urlOriginal: f.urlOriginal },
        select: { id: true },
      });
      await prisma.followUp.upsert({
        where: { userId_propertyId: { userId, propertyId: property.id } },
        update: {
          attempts: f.attempts,
          status: f.status,
          lastContactAt: f.lastContactAt ? new Date(f.lastContactAt) : null,
        },
        create: {
          userId,
          propertyId: property.id,
          attempts: f.attempts,
          status: f.status,
          lastContactAt: f.lastContactAt ? new Date(f.lastContactAt) : null,
        },
      });
      upserted++;
    }

    return NextResponse.json({ ok: true, upserted });
  } catch (e) {
    const issues = getZodIssues(e);
    if (issues) {
      return NextResponse.json({ error: "Dados inválidos", details: issues }, { status: 400 });
    }
    logger.error("[sync/push] 500", { userId }, e);
    return NextResponse.json({ error: "Erro ao sincronizar" }, { status: 500 });
  }
}
