import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { requireAuth, type Role } from "./api-auth";
import { getClientIp, isIpAllowed } from "./ip-allowlist";

export function getCronIpAllowlist(): string | undefined {
  return process.env.CRON_IP_ALLOWLIST;
}

export function hasCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const match = (provided: string | null) => {
    if (!provided) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  };
  if (match(request.headers.get("x-cron-secret"))) return true;
  const auth = request.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  return false;
}

/**
 * Retorna um Response de erro (já com status) ou `null` quando autorizado.
 * Ordem: allowlist de IP → CRON_SECRET → sessão ADMIN.
 */
export async function authorizeCron(request: Request): Promise<Response | null> {
  const allowlist = getCronIpAllowlist();
  if (allowlist) {
    if (isIpAllowed(getClientIp(request), allowlist)) return null;
    return NextResponse.json({ error: "IP não autorizado" }, { status: 403 });
  }
  if (hasCronSecret(request)) return null;
  const { error } = await requireAuth(request, "ADMIN" as Role);
  if (error) return error;
  return null;
}
