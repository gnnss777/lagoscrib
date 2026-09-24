import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [total, visitados, novos] = await Promise.all([
    prisma.savedProperty.count({ where: { userId: user.id } }),
    prisma.savedProperty.count({ where: { userId: user.id, status: "visitado" } }),
    prisma.savedProperty.count({ where: { userId: user.id, status: "novo" } }),
  ]);

  return NextResponse.json({ total, visitados, novos });
}
