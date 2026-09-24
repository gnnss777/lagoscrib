import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requireAuth(request);
  if (error) return error;

  const { id } = await params;
  const apartment = await prisma.savedProperty.findFirst({
    where: { id, userId: session!.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!apartment) {
    return NextResponse.json({ error: "Apartamento não encontrado" }, { status: 404 });
  }

  await prisma.savedProperty.update({
    where: { id: apartment.id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
