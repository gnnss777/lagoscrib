import { logger } from "./logger";

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Rate limiting em memória por processo (modo do app `só`).
 * Limitação conhecida em serverless: mitiga por instância; para a central
 * agregadora em escala, migrar para `rateLimitAsync` com Upstash
 * (UPSTASH_REDIS_REST_URL/TOKEN) seguindo o padrão do `só`.
 */

type WindowEntry = { count: number; resetAt: number };

const buckets = new Map<string, WindowEntry>();
const SWEEP_THRESHOLD = 1_000;

function sweepExpired(now: number) {
  if (buckets.size < SWEEP_THRESHOLD) return;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

function memoryIncr(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweepExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  bucket.count++;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function getRateLimitKey(request: Request): string {
  let pathname = "unknown";
  try {
    pathname = new URL(request.url).pathname || "unknown";
  } catch {
    pathname = "unknown";
  }
  const region = process.env.VERCEL_REGION || "local";
  return `${region}:${pathname}:${getClientIp(request)}`;
}

export function rateLimit(request: Request, limit: number, windowMs: number): RateLimitResult {
  if (process.env.VERCEL) {
    logger.warn("[rate-limit] modo memória em serverless — configure Upstash para proteção distribuída");
  }
  return memoryIncr(getRateLimitKey(request), limit, windowMs);
}

/** Limpa buckets locais (uso exclusivo de testes). */
export function clearRateLimitBuckets() {
  buckets.clear();
}
