import { logger } from "./logger";

// Checagem de domínio descartável SEM dado pessoal: apenas a parte após "@" é
// enviada ao serviço externo. Fail-open: qualquer falha permite o cadastro.
// Padrão do app `só`.
const MAILCHECK_DOMAIN_ENDPOINT = "https://www.mailcheck.ai/api/v1/domain";
const REQUEST_TIMEOUT_MS = 3_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

type CacheEntry = { disposable: boolean; expiresAt: number };
const cache = new Map<string, CacheEntry>();

export function clearDisposableEmailCache() {
  cache.clear();
}

export function extractEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  const domain = at >= 0 ? trimmed.slice(at + 1) : "";
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? domain : null;
}

export async function isDisposableEmail(email: string): Promise<boolean> {
  const domain = extractEmailDomain(email);
  if (!domain) return false;

  const cached = cache.get(domain);
  if (cached && cached.expiresAt > Date.now()) return cached.disposable;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${MAILCHECK_DOMAIN_ENDPOINT}/${encodeURIComponent(domain)}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as { disposable?: boolean };
    const disposable = data?.disposable === true;
    cache.set(domain, { disposable, expiresAt: Date.now() + CACHE_TTL_MS });
    return disposable;
  } catch (e) {
    logger.warn("[disposable-email] checagem indisponível — fail-open", { domain }, e);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
