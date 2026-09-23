import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isAllowedOrigin } from "@/lib/security";

export type Role = "ADMIN" | "USER";

export const API_RATE_LIMIT = 120;
export const API_RATE_WINDOW_MS = 60_000;

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function requireAuth(request: Request, minRole?: Role) {
  const limited = rateLimit(request, API_RATE_LIMIT, API_RATE_WINDOW_MS);
  if (!limited.ok) {
    return {
      error: NextResponse.json(
        { error: "Muitas requisições. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
      ),
      session: null,
    };
  }

  const origin = request.headers.get("origin");
  if (UNSAFE_METHODS.has(request.method) && origin && !isAllowedOrigin(origin)) {
    return { error: NextResponse.json({ error: "Origem não permitida" }, { status: 403 }), session: null };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }), session: null };
  }
  if (minRole) {
    const hierarchy: Record<Role, number> = { ADMIN: 2, USER: 1 };
    const userLevel = hierarchy[session.user.role as Role] || 0;
    const requiredLevel = hierarchy[minRole] || 0;
    if (userLevel < requiredLevel) {
      return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }), session: null };
    }
  }
  return { error: null, session };
}
