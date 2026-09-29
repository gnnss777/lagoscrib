import { z } from "zod";
import {
  REMOVED_IDS_STORAGE_KEY,
  // Sem esta constante o applySnapshot gravava `version: 1` fixo e o leitor em
  // lib/pool.ts descarta a chave quando a versão não bate — o excluído chegava
  // no navegador e era ignorado. Testado: version 2 em disco, 1 escrito.
  REMOVED_IDS_STORAGE_VERSION,
} from "@/lib/constants";
import { USER_ADDED_KEY } from "@/lib/pool";
import type { Apartment } from "@/lib/data";
import type { ApartmentStatus, FollowUp } from "@/lib/kanban";
import { ALL_STATUSES } from "@/lib/kanban";
import type { Note } from "@/lib/AppContext";

/**
 * Estado do dono, compartilhado entre dispositivos.
 *
 * Tudo que o app guarda hoje é localStorage (por navegador): deletados, kanban,
 * notas, checklist e follow-up. Abrir em outro PC mostra a base inteira como se
 * nada tivesse sido mexido. Aqui mora o documento que fecha essa conta.
 *
 * O formato é o mesmo nos dois lados e versionado (`v`), porque a forma do
 * localStorage já migra sozinho e o servidor precisa saber qual versão gravou.
 *
 * O que NÃO entra: `isAuthenticated` e `username`. Isso é estado de sessão, não
 * dado do dono — sincronizar faria o login de um dispositivo bagunçar o outro.
 */

/** Chave do estado do AppContext no localStorage (fonte canônica). */
export const APP_STATE_KEY = "apartamentos-app-state";


export const SNAPSHOT_VERSION = 1;
export const OWNER_STATE_KEY = "lagoscrib:owner-state:v1";
/** Teto do documento. A base tem 88 imóveis; folga grande, o payload é minúsculo. */
export const MAX_SNAPSHOT_BYTES = 512 * 1024;

const noteSchema = z.object({
  id: z.string().min(1).max(64),
  apartmentId: z.string().min(1).max(120),
  text: z.string().min(1).max(2000),
  createdAt: z.string().min(1).max(40),
});

const statusSchema = z.object({
  apartmentId: z.string().min(1).max(120),
  // Enum, não string livre: status fora de ALL_STATUSES é lixo e faria o card
  // sumir do quadro sem aviso (ver isKanbanExcludedStatus).
  status: z.enum(ALL_STATUSES),
  updatedAt: z.string().min(1).max(40),
  scheduledDate: z.string().max(40).nullish(),
  index: z.number().int().min(0).max(10_000).optional(),
});

const followUpSchema = z.object({
  attempts: z.number().int().min(0).max(10_000),
  status: z.enum(["aguardando", "retornou"]),
  lastContactAt: z.string().max(40).nullable().optional(),
});

const checklistMap = z.record(z.string().min(1).max(120), z.array(z.string().min(1).max(64)).max(200));
const followUpsMap = z.record(z.string().min(1).max(120), followUpSchema);

/** Aceita o que o servidor devolve; descarta o que não bater (fwd-compat). */
export const snapshotSchema = z.object({
  v: z.literal(SNAPSHOT_VERSION),
  updatedAt: z.string().min(1).max(40),
  removedIds: z.array(z.string().min(1).max(120)).max(5_000),
  userAdded: z.array(z.unknown()).max(5_000),
  notes: z.array(noteSchema).max(20_000),
  statuses: z.array(statusSchema).max(5_000),
  checklist: checklistMap,
  followUps: followUpsMap,
});

export type OwnerSnapshot = z.infer<typeof snapshotSchema>;

export interface SyncResult {
  ok: boolean;
  /** Motivo da recusa, para mostrar no app em vez de "deu erro". */
  reason?: string;
}

/** Estado visível do sync, para o app mostrar o que está acontecendo. */
export type SyncStatus = "off" | "idle" | "syncing" | "error" | "denied";

/* ------------------------------------------------------------------ token */
//
// O token de sync foi removido. A credencial é agora o cookie de sessão do
// NextAuth: quem está logado no app já está autorizado a ler e escrever o
// estado do dono, então uma segunda senha só criava atrito (digitar um código em
// cada aparelho) sem adicionar proteção. O que protegia era o segredo de uma
// tela que fica logada de qualquer jeito.


/* --------------------------------------------------------------- montagem */

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Documento montado a partir das três chaves que o app usa hoje. Roda no
 * cliente, no momento do push, então lê o localStorage na hora — não depende de
 * estado React e não pode ficar velho.
 */
export function buildSnapshot(now: Date = new Date()): OwnerSnapshot {
  const appState = readJson<{
    notes?: Note[];
    statuses?: ApartmentStatus[];
    checklist?: Record<string, string[]>;
    followUps?: Record<string, FollowUp>;
  }>(APP_STATE_KEY, {});
  const removed = readJson<{ ids?: string[] }>(REMOVED_IDS_STORAGE_KEY, {});
  const userAdded = readJson<Apartment[]>(USER_ADDED_KEY, []);
  return {
    v: SNAPSHOT_VERSION,
    updatedAt: now.toISOString(),
    removedIds: Array.isArray(removed.ids) ? removed.ids : [],
    userAdded: Array.isArray(userAdded) ? userAdded : [],
    notes: Array.isArray(appState.notes) ? appState.notes : [],
    statuses: Array.isArray(appState.statuses) ? appState.statuses : [],
    checklist: appState.checklist ?? {},
    followUps: appState.followUps ?? {},
  };
}

/** Snapshot vazio — o que um dispositivo novo começa com. */
export function emptySnapshot(now: Date = new Date()): OwnerSnapshot {
  return {
    v: SNAPSHOT_VERSION,
    updatedAt: now.toISOString(),
    removedIds: [],
    userAdded: [],
    notes: [],
    statuses: [],
    checklist: {},
    followUps: {},
  };
}

/* ------------------------------------------------------------------ merge */

/**
 * Decide o que um aparelho faz ao abrir: adota o servidor ou sobe o local.
 *
 * O erro que motivou isto: comparar por `updatedAt` do CLIENTE faz qualquer
 * aparelho recém-aberto parecer o mais novo — `buildSnapshot()` carimba `new
 * Date()`, que sempre vence o documento do servidor. Resultado: todo
 * dispositivo novo empurrava o estado vazio por cima do que o dono tinha feito
 * (last-write-wins não protege nada quando o relógio é do cliente).
 *
 * Por isso o primeiro sync de um aparelho é SEMPRE leitura: o servidor é o
 * acumulado. Só depois que o aparelho tem uma base comparada é que o relógio
 * local vale, e ainda assim só quando o conteúdo mudou de verdade
 * (`samePayload`).
 */
export function reconcileOnLoad(
  local: OwnerSnapshot,
  remote: OwnerSnapshot | null,
): { snapshot: OwnerSnapshot; adoptedRemote: boolean } {
  if (!remote) return { snapshot: local, adoptedRemote: false };
  // Rede de segurança, não estratégia: um aparelho COM estado nunca adota um
  // servidor vazio, porque servidor vazio na prática significa "um aparelho
  // sem localStorage empurrou o dele".
  //
  // Como aconteceu: abrir o site numa aba anônima monta um snapshot vazio, o
  // reconcile (que antes era "adota o remoto sempre") jogava esse vazio no
  // servidor, e o aparelho que tinha o kanban real o adotava no próximo pull —
  // apagando o trabalho do dono. O sintoma era "entro e o kanban está vazio".
  //
  // Aqui só se inverte quando o local tem conteúdo e o remoto não. Se os dois
  // têm conteúdo, o remoto continua mandando (last-write-wins normal) e se os
  // dois estão vazios, tanto faz.
  if (vazio(remote) && !vazio(local)) return { snapshot: local, adoptedRemote: false };
  return { snapshot: remote, adoptedRemote: true };
}

/** O documento não carrega nada que o dono tenha feito? */
function vazio(s: OwnerSnapshot): boolean {
  return (
    s.removedIds.length === 0 &&
    s.userAdded.length === 0 &&
    s.notes.length === 0 &&
    s.statuses.length === 0 &&
    // `followUps` é mapa de id -> objeto de histórico, não lista.
    Object.keys(s.followUps).length === 0 &&
    Object.keys(s.checklist).length === 0
  );
}

/**
 * Dois documentos têm o mesmo conteúdo? Compara sem `updatedAt`, que é
 * carimbo de escrita e muda a cada `buildSnapshot()`.
 *
 * É isto que segura o aparelho que só lê: ele monta um snapshot idêntico ao que
 * acabou de puxar, o payload bate e o push é cancelado. Sem essa comparação, um
 * aparelho que abre o app sobrescreve o dono no servidor (last-write-wins) e o
 * que ele mexeu some.
 */
export function samePayload(
  a: OwnerSnapshot | null,
  b: OwnerSnapshot,
): boolean {
  if (!a) return false;
  const { updatedAt: _a, ...restA } = a;
  const { updatedAt: _b, ...restB } = b;
  return JSON.stringify(restA) === JSON.stringify(restB);
}

/** Grava o documento nos três lugares de onde o app lê. */
export function applySnapshot(s: OwnerSnapshot): void {
  if (typeof localStorage === "undefined") return;
  try {
    const current = readJson<Record<string, unknown>>(APP_STATE_KEY, {});
    localStorage.setItem(
      APP_STATE_KEY,
      JSON.stringify({
        ...current,
        notes: s.notes,
        statuses: s.statuses,
        checklist: s.checklist,
        followUps: s.followUps,
      }),
    );
    localStorage.setItem(
      REMOVED_IDS_STORAGE_KEY,
      JSON.stringify({ version: REMOVED_IDS_STORAGE_VERSION, ids: s.removedIds }),
    );
    localStorage.setItem(USER_ADDED_KEY, JSON.stringify(s.userAdded));
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------- rede */

async function request(path: "GET" | "PUT", body?: OwnerSnapshot): Promise<SyncResult> {
  const url = process.env.NEXT_PUBLIC_SYNC_URL ?? "/api/owner-state";
  try {
    const res = await fetch(url, {
      method: path,
      // A sessão vai no cookie; o antigo header x-sync-token foi removido junto
      // com a UI que pedia o código. `include` é o que faz o cookie viajar numa
      // rota /api do mesmo domínio.
      credentials: "include",
      headers: body ? { "content-type": "application/json" } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 401) return { ok: false, reason: "Sessão expirada" };
    if (res.status === 503) return { ok: false, reason: "Sync não configurado" };
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: "Sem rede" };
  }
}

/** Estado do servidor, ou null se nunca foi gravado. */
export async function pullSnapshot(): Promise<{
  ok: boolean;
  snapshot: OwnerSnapshot | null;
  reason?: string;
}> {
  const url = process.env.NEXT_PUBLIC_SYNC_URL ?? "/api/owner-state";
  try {
    // A credencial é o cookie de sessão, não um código: quem está logado já tem.
    const res = await fetch(url, { credentials: "include" });
    if (res.status === 401) return { ok: false, snapshot: null, reason: "Sessão expirada" };
    if (res.status === 503) return { ok: false, snapshot: null, reason: "Sync não configurado" };
    if (!res.ok) return { ok: false, snapshot: null, reason: `HTTP ${res.status}` };
    const json = (await res.json()) as { data?: unknown };
    if (!json.data) return { ok: true, snapshot: null };
    const parsed = snapshotSchema.safeParse(json.data);
    return parsed.success
      ? { ok: true, snapshot: parsed.data }
      : { ok: false, snapshot: null, reason: "Formato do servidor não reconhecido" };
  } catch {
    return { ok: false, snapshot: null, reason: "Sem rede" };
  }
}

export function pushSnapshot(snapshot: OwnerSnapshot): Promise<SyncResult> {
  return request("PUT", snapshot);
}
