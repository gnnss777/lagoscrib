import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

/** Banco como fonte da verdade após a primeira sincronização (escopo do usuário). */
export async function GET(request: Request) {
  const { error, session } = await requireAuth(request);
  if (error) return error;
  const userId = session!.user.id;

  const properties = await prisma.savedProperty.findMany({
    where: { userId },
    include: { followUps: true, notes: { orderBy: { createdAt: "desc" } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(
    {
      properties: properties.map((p) => ({
        externalId: p.externalId,
        portal: p.portal,
        urlOriginal: p.urlOriginal,
        status: p.status,
        updatedAt: p.updatedAt.toISOString(),
        followUp: p.followUps[0]
          ? {
              attempts: p.followUps[0].attempts,
              status: p.followUps[0].status,
              lastContactAt: p.followUps[0].lastContactAt?.toISOString() ?? null,
            }
          : null,
        notes: p.notes.map((n) => ({ text: n.text, createdAt: n.createdAt.toISOString() })),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
