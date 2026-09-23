import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { isBusinessHours, maskPhone } from "@/lib/phone-gate";

/**
 * Gate de telefone por horário comercial (plano §5.1).
 * - Autenticado (USER), rate limit 30/min.
 * - Em horário comercial: retorna telefone + links (audita CONTACT_REVEAL).
 * - Fora do horário: o campo `phone` é OMITIDO do JSON — só máscara + link.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth(request);
  if (error) return error;

  const limited = rateLimit(request, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  const { id } = await params;
  const contact = await prisma.propertyContact.findUnique({ where: { id } });
  if (!contact) {
    return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
  }

  if (!isBusinessHours()) {
    return NextResponse.json(
      {
        id: contact.id,
        masked: contact.phone ? maskPhone(contact.phone) : null,
        sourceUrl: contact.sourceUrl,
        businessHours: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  await prisma.privacyAuditLog.create({
    data: { userId: session!.user.id, action: "CONTACT_REVEAL", detail: contact.id },
  });

  return NextResponse.json(
    {
      id: contact.id,
      phone: contact.phone,
      masked: contact.phone ? maskPhone(contact.phone) : null,
      sourceUrl: contact.sourceUrl,
      businessHours: true,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
