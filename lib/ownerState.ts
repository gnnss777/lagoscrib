import { z } from "zod";
import { REMOVED_IDS_STORAGE_KEY } from "@/lib/constants";
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
/** Token de sync, guardado só neste dispositivo. */
export const SYNC_TOKEN_KEY = "apartamentos-app-sync-token";

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

export function readSyncToken(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(SYNC_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeSyncToken(token: string): void {
  try {
    // Trim aqui e não no chamador: código colado costuma vir com espaço ou
    // quebra de linha no fim, e a comparação do servidor é exata — sem isso o
    // aparelho ficaria em "Código inválido" para sempre sem motivo visível.
    localStorage.setItem(SYNC_TOKEN_KEY, token.trim());
  } catch {
    // sem localStorage = sem sync, sem quebrar o app
  }
}

export function clearSyncToken(): void {
  try {
    localStorage.removeItem(SYNC_TOKEN_KEY);
  } catch {
    // ignore
  }
}

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
 * Last-write-wins no documento inteiro, comparado por `updatedAt`.
 *
 * Escolha deliberada: um dono só, dois ou três aparelhos. Merge por campo
 * (união de removidos, card mais novo por imóvel) darialicts que ninguém
 * consegue prever; LWW dá uma regra que o dono entende — "o último aparelho que
 * mexeu manda". O custo é perder a edição de um aparelho offline depois que o
 * outro synchonizou, e isso é aceitável para uso pessoal.
 */
export function mergeSnapshots(
  local: OwnerSnapshot,
  remote: OwnerSnapshot | null,
): { snapshot: OwnerSnapshot; adoptedRemote: boolean } {
  if (!remote) return { snapshot: local, adoptedRemote: false };
  if (remote.updatedAt > local.updatedAt) {
    return { snapshot: remote, adoptedRemote: true };
  }
  return { snapshot: local, adoptedRemote: false };
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
      JSON.stringify({ version: 1, ids: s.removedIds }),
    );
    localStorage.setItem(USER_ADDED_KEY, JSON.stringify(s.userAdded));
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------- rede */

async function request(
  path: "GET" | "PUT",
  token: string,
  body?: OwnerSnapshot,
): Promise<SyncResult> {
  const url = process.env.NEXT_PUBLIC_SYNC_URL ?? "/api/owner-state";
  try {
    const res = await fetch(url, {
      method: path,
      headers: {
        "x-sync-token": token,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 401) return { ok: false, reason: "Código inválido" };
    if (res.status === 503) return { ok: false, reason: "Sync não configurado" };
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: "Sem rede" };
  }
}

/** Estado do servidor, ou null se nunca foi gravado. */
export async function pullSnapshot(token: string): Promise<{
  ok: boolean;
  snapshot: OwnerSnapshot | null;
  reason?: string;
}> {
  if (!token) return { ok: false, snapshot: null, reason: "Sem código" };
  const url = process.env.NEXT_PUBLIC_SYNC_URL ?? "/api/owner-state";
  try {
    const res = await fetch(url, { headers: { "x-sync-token": token } });
    if (res.status === 401) return { ok: false, snapshot: null, reason: "Código inválido" };
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

export function pushSnapshot(token: string, snapshot: OwnerSnapshot): Promise<SyncResult> {
  if (!token) return Promise.resolve({ ok: false, reason: "Sem código" });
  return request("PUT", token, snapshot);
}
