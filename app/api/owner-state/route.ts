import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { redisConfigured, redisGet, redisSet, RedisNotConfiguredError } from "@/lib/redis";
import {
  MAX_SNAPSHOT_BYTES,
  OWNER_STATE_KEY,
  snapshotSchema,
} from "@/lib/ownerState";

/**
 * Estado compartilhado do dono (KISS, uso pessoal).
 *
 * Um único documento JSON no Redis. Sem isso o estado vivia só no localStorage e
 * abrir em outro PC mostrava a base inteira como se nada tivesse sido mexido.
 *
 * A credencial é a sessão do NextAuth, não um código: o dono já faz login para
 * usar o app, então exigir um segundo segredo por aparelho só criava atrito. É
 * a mesma regra das outras rotas `/api/*` — mesma sessão, mesmo portão.
 *
 * Isso é single-tenant de propósito: o dono pediu o caminho simples, e o ADR-001
 * recusou inventar multiusuário. O preço é que existe um único documento — se
 * algum dia forem duas pessoas, isto é o primeiro lugar a refazer.
 */

/** Há sessão válida? Autorização das duas rotas. */
async function temSessao(): Promise<boolean> {
  const session = await auth();
  return Boolean(session?.user?.email);
}

function unauthorized() {
  return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
}


export async function GET(request: Request) {
  if (!(await temSessao())) return unauthorized();
  if (!redisConfigured()) {
    return NextResponse.json(
      { error: "Sync não configurado (UPSTASH_REDIS_REST_URL/TOKEN)" },
      { status: 503 },
    );
  }

  const limited = rateLimit(request, 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Muitas requisições" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  try {
    const raw = await redisGet(OWNER_STATE_KEY);
    if (!raw) return NextResponse.json({ data: null }, { headers: { "Cache-Control": "no-store" } });
    const parsed = snapshotSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      // Documento gravado por versão futura: não descarta, não sobrescreve.
      logger.error("[owner-state] formato desconhecido no redis", undefined, parsed.error);
      return NextResponse.json({ data: null, reason: "formato" }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ data: parsed.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof RedisNotConfiguredError) {
      return NextResponse.json({ error: "Sync não configurado" }, { status: 503 });
    }
    logger.error("[owner-state] GET 500", undefined, e);
    return NextResponse.json({ error: "Erro ao ler o estado" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await temSessao())) return unauthorized();

  // Payload primeiro, Redis depois: entrada inválida é erro da requisição (400)
  // e vale saber disso mesmo com a infra fora do ar. O contrário faria todo
  // 400 parecer "não configurado".
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_SNAPSHOT_BYTES) {
      return NextResponse.json({ error: "Estado grande demais" }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = snapshotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.issues.slice(0, 5) },
      { status: 400 },
    );
  }

  if (!redisConfigured()) {
    return NextResponse.json(
      { error: "Sync não configurado (UPSTASH_REDIS_REST_URL/TOKEN)" },
      { status: 503 },
    );
  }

  const limited = rateLimit(request, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Muitas requisições" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  try {
    await redisSet(OWNER_STATE_KEY, JSON.stringify(parsed.data));
    return NextResponse.json({ ok: true, updatedAt: parsed.data.updatedAt });
  } catch (e) {
    if (e instanceof RedisNotConfiguredError) {
      return NextResponse.json({ error: "Sync não configurado" }, { status: 503 });
    }
    logger.error("[owner-state] PUT 500", undefined, e);
    return NextResponse.json({ error: "Erro ao gravar o estado" }, { status: 500 });
  }
}
