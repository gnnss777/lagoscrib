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

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export function redisConfigured(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

export class RedisNotConfiguredError extends Error {
  constructor() {
    super("UPSTASH_REDIS_REST_URL/TOKEN não configurados");
    this.name = "RedisNotConfiguredError";
  }
}

async function command(parts: (string | number)[]): Promise<unknown> {
  if (!REDIS_URL || !REDIS_TOKEN) throw new RedisNotConfiguredError();
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
