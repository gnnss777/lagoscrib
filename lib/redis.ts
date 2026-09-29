import { logger } from "@/lib/logger";

/**
 * Cliente mínimo do Upstash Redis pela REST API, com `fetch` — o pacote
 * @upstash/redis não é necessário para GET/SET de uma string, e a app já não
 * tem nenhuma dependência de infra.
 *
 * Fail closed de propósito: sem URL/TOKEN a rota responde 503 em vez de
 * simular sucesso. Um sync "funcionando" sem destino perderia o estado do dono
 * silenciosamente, que é o pior jeito de falhar.
 *
 * Os nomes das envs são os mesmos que lib/rate-limit.ts já cita como caminho
 * previsto para o rate limit distribuído.
 */

const REDIS_URL = env("UPSTASH_REDIS_REST_URL");
const REDIS_TOKEN = env("UPSTASH_REDIS_REST_TOKEN");

/**
 * Lê env var tirando aspas em volta.
 *
 * Não é preciosismo: um `.env.local` escrito à mão como
 * `UPSTASH_REDIS_REST_URL="https://x.upstash.io"` entrega a aspa como parte do
 * valor, e aí `fetch` estoura com "Invalid URL" — 500 em vez do 503 que este
 * arquivo promete. O mesmo formato quebrava o `SYNC_TOKEN`, que passava a
 * nunca casar com o código que o dono digita.
 */
function env(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const t = raw.replace(/^["']|["']$/g, "").trim();
  return t || undefined;
}

export function redisConfigured(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN && isHttpUrl(REDIS_URL));
}

function isHttpUrl(u: string): boolean {
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:";
  } catch {
    return false;
  }
}

export class RedisNotConfiguredError extends Error {
  constructor() {
    super("UPSTASH_REDIS_REST_URL/TOKEN não configurados");
    this.name = "RedisNotConfiguredError";
  }
}

async function command(parts: (string | number)[]): Promise<unknown> {
  // Check inline (e não via redisConfigured) para o TypeScript estreitar REDIS_URL
  // para string: é o mesmo teste, mas aqui ele serve de type guard.
  if (!REDIS_URL || !REDIS_TOKEN || !isHttpUrl(REDIS_URL)) throw new RedisNotConfiguredError();
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${REDIS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(parts),
  });
  if (!res.ok) {
    logger.error("[redis] comando falhou", { status: res.status }, undefined);
    throw new Error(`redis ${res.status}`);
  }
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(`redis: ${json.error}`);
  return json.result;
}

export async function redisGet(key: string): Promise<string | null> {
  const result = await command(["GET", key]);
  return typeof result === "string" ? result : null;
}

export async function redisSet(key: string, value: string): Promise<void> {
  await command(["SET", key, value]);
}
