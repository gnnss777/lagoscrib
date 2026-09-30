import { z } from "zod";
import {
  REMOVED_IDS_STORAGE_KEY,
  // Sem esta constante o applySnapshot gravava `version: 1` fixo e o leitor em
  // lib/pool.ts descarta a chave quando a versão não bate — o excluído chegava
  // no navegador e era ignorado. Testado: version 2 em disco, 1 escrito.
  REMOVED_IDS_STORAGE_VERSION,
} from "@/lib/constants";
import { USER_ADDED_KEY } from "@/lib/pool";
import {
  USER_ADDED_REMOVED_KEY,
  USER_ADDED_REMOVED_VERSION,
} from "@/lib/constants";
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
/** Teto do documento. A base tem 88 imóveis; folga grande, o payload é minúsculo. */
export const MAX_SNAPSHOT_BYTES = 512 * 1024;

/**
 * Chave padrão do documento no Redis. NÃO MUDE: o estado do dono já está gravado
 * com este nome e o Redis não renomeia nada — trocar o default faz o app abrir
 * vazio sem nenhum erro, porque a chave nova simplesmente não existe.
 */
export const DEFAULT_OWNER_STATE_KEY = "lagoscrib:owner-state:v1";

/** Teto da chave: pegadinha de .env colado errado não vira chave de 4 KB. */
const MAX_KEY_LENGTH = 256;

export type OwnerStateKey =
  | { ok: true; key: string }
  | { ok: false; reason: string };

/**
 * Chave do documento, resolvida na HORA DO USO — não no import.
 *
 * Era `export const OWNER_STATE_KEY = "lagoscrib:owner-state:v1"`, avaliada uma
 * vez quando o módulo carrega. Isso quebrava nos dois lugares que mais importam:
 * num teste, que faz `vi.stubEnv` depois do import (a const já estava congelada
 * com o valor antigo), e num runtime onde a env chega depois do módulo estar na
 * cache. Como função, cada requisição relê o ambiente — e é isso que permite o
 * segundo deploy apontar para o namespace dele sem tocar em código.
 *
 * Precedência: `OWNER_STATE_KEY` explícita; sem ela, o default acima.
 *
 * Env setada mas inválida NÃO cai no default de propósito: o default é o
 * namespace do dono, e um segundo cliente que caísse nele continuaria
 * enxergando — e sobrescrevendo — o kanban alheio. Falhar fechado (503) é
 * barulhento; herdar a chave do outro é silencioso.
 *
 * Aspas em volta são removidas pelo mesmo motivo do `env()` em lib/redis.ts: um
 * `.env.local` escrito à mão como `OWNER_STATE_KEY="cliente-b:owner-state"`
 * entregaria aspas como parte da chave, e GET/PUT passariam a bater em outra
 * chave sem erro nenhum. O `env()` de lá não é importado aqui porque este
 * módulo entra no bundle do cliente — não se arrasta a infra de Redis junto.
 */
export function resolveOwnerStateKey(
  raw: string | undefined = process.env.OWNER_STATE_KEY,
): OwnerStateKey {
  // Ausente = dono. Setada e estragada = fail closed (ver acima).
  if (raw === undefined) return { ok: true, key: DEFAULT_OWNER_STATE_KEY };

  const key = raw.trim().replace(/^["']|["']$/g, "").trim();
  if (!key) {
    return {
      ok: false,
      reason: "OWNER_STATE_KEY vazia — apague a variável para usar a chave padrão",
    };
  }
  if (key.length > MAX_KEY_LENGTH) {
    return { ok: false, reason: `OWNER_STATE_KEY acima de ${MAX_KEY_LENGTH} caracteres` };
  }
  // Allowlist, não deny-list: o namespace é nosso, então o conjunto é fechado e
  // qualquer caractere fora dele (espaço, aspa interna, `\n` de .env quebrado)
  // recusa em vez de passar adiante. Chave é URL-safe de propósito.
  if (/[^a-zA-Z0-9:._/-]/.test(key)) {
    return {
      ok: false,
      reason: "OWNER_STATE_KEY com caractere fora de [letras, números, : - _ . /]",
    };
  }
  return { ok: true, key };
}

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
  // `.default([])` e não campo obrigatório: documentos gravados antes desta
  // versão não têm a chave, e um campo obrigatório reprovaria o parse
  // inteiro — o `GET` devolveria `data: null` e o aparelho subiria o estado
  // vazio por cima do do dono. Ausente = vazio = comportamento antigo.
  deletedUserAdded: z.array(z.string().min(1).max(120)).max(5_000).default([]),
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
  const deletedUserAdded = readJson<{ ids?: string[] }>(USER_ADDED_REMOVED_KEY, {});
  return {
    v: SNAPSHOT_VERSION,
    updatedAt: now.toISOString(),
    removedIds: Array.isArray(removed.ids) ? removed.ids : [],
    userAdded: Array.isArray(userAdded) ? userAdded : [],
    deletedUserAdded: Array.isArray(deletedUserAdded.ids) ? deletedUserAdded.ids : [],
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
    deletedUserAdded: [],
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
 *
 * "Adota o servidor" é ADOTAR CAMPO A CAMPO (`mergeSnapshots`), nunca o
 * documento inteiro: o documento do dono está no Upstash, então num aparelho
 * real o remoto nunca está vazio e a substituição pura apagava o que só
 * existia aqui — inclusive os imóveis que o dono cadastrou à mão.
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
  // A trava fica mesmo depois do merge virar união, porque com o merge o
  // resultado seria o local de qualquer jeito — ela existe para o
  // `adoptedRemote` valer: servidor vazio não é "adotado", é "ignorado", e é
  // isso que faz o aparelho subir o local em vez de se applieditar.
  if (vazio(remote) && !vazio(local)) return { snapshot: local, adoptedRemote: false };
  return { snapshot: mergeSnapshots(local, remote), adoptedRemote: true };
}

/**
 * União por id, na ordem do primeiro documento e sem repetir id.
 *
 * `idDe` devolve `null` quando o item não tem id usável: aí ele entra assim
 * mesmo (jogar fora dato do dono seria pior que duplicá-lo) e só não conta
 * como visto, porque não há como casá-lo com o do outro lado.
 */
function unionById<T>(
  primeiro: readonly T[],
  segundo: readonly T[],
  idDe: (item: T) => string | null,
): T[] {
  const vistos = new Set<string>();
  const saida: T[] = [];
  for (const item of [...primeiro, ...segundo]) {
    const id = idDe(item);
    if (id !== null) {
      if (vistos.has(id)) continue;
      vistos.add(id);
    }
    saida.push(item);
  }
  return saida;
}

/** `userAdded` é `unknown[]` no schema: o id se extrai sem confiar no formato. */
function idDeImovel(item: unknown): string | null {
  const id = (item as { id?: unknown } | null | undefined)?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Uma entrada por imóvel, com o `updatedAt` mais novo. O empate fica com o
 * remoto, que é o acumulado: foi ele que o dono acabou de escrever no outro
 * aparelho.
 */
function mesclarPorMaisNovo<T extends { updatedAt: string }>(
  local: readonly T[],
  remote: readonly T[],
  idDe: (item: T) => string,
): T[] {
  const porId = new Map<string, T>();
  for (const item of remote) porId.set(idDe(item), item);
  for (const item of local) {
    const atual = porId.get(idDe(item));
    if (!atual || item.updatedAt > atual.updatedAt) porId.set(idDe(item), item);
  }
  return [...porId.values()];
}

/**
 * Documento único a partir do que este aparelho tem e do que o servidor tem.
 *
 * Cada campo recebe a regra que O DADO pede, não uma regra única:
 *
 * - `userAdded` — UNIÃO por id. Um imóvel digitado à mão neste aparelho é
 *   local por natureza: o servidor não tem como saber que ele existe, então
 *   um documento remoto velho não pode apagá-lo.
 *
 *   ponytail: a união não propaga a EXCLUSÃO de um imóvel cadastrado à mão —
 *   `removeApartment` tira a linha da lista e não deixa lápide (o
 *   `test_delete_new_remove_fisico_sem_removed_ids` exige `removed === null`),
 *   então no outro aparelho a união traz o imóvel de volta. Teto conhecido.
 *   Subir para uma lápide no documento (`deletedUserAdded`) quando o dono
 *   precisar excluir em dois aparelhos.
 *
 * - `removedIds` — UNIÃO. É um conjunto de lápides: a única forma de
 *   encolhê-lo é limpar o storage do aparelho, e limpar o storage joga fora as
 *   lápides daquele aparelho junto. Nada no app desfaz remoção, então a união
 *   não devolve imóvel excluído por um documento que não conhece a exclusão —
 *   que é o dano que a substituição pura causava.
 *
 * - `notes` — UNIÃO por id. `addNote` gera `note-<agora>-<aleatório>`: dois
 *   aparelhos nunca colidem no mesmo id, então unir não duplica nem perde.
 *
 * - `statuses` — LAST-WRITE-WINS por imóvel, pelo `updatedAt`. Aqui o valor é
 *   uma POSIÇÃO, não um evento: são duas linhas para o mesmo imóvel, e o card
 *   some da coluna se houver duplicata. decided o relógio que o próprio campo
 *   carrega (e não o do aparelho, que é justamente o que não se confia).
 *
 * - `checklist` / `followUps` — UNIÃO por CHAVE, com o valor do remoto
 *   vencendo a chave que ele conhece. Unir os ITENS do checklist seria
 *   errado no caminho inverso: desticar um item num aparelho e voltar no
 *   outro o traz de volta. O que se preserva é a chave que o servidor nunca
 *   viu (checklist de um imóvel que só existe aqui), não o conteúdo de uma
 *   chave que ele já viu.
 *
 * `updatedAt` é o do remoto, nunca o local: o relógio do cliente já provou
 * não valer para decidir nada aqui (ver a nota do last-write-wins acima).
 *
 * Com o local vazio o resultado é o remoto INTEIRO — nenhuma regra acima
 * muda isso, porque união com nada é o documento e last-write-wins sem
 * concorrência é o documento. É o que faz o aparelho novo abrir com o funil
 * do dono em vez de vazio.
 */
function mergeSnapshots(local: OwnerSnapshot, remote: OwnerSnapshot): OwnerSnapshot {
  // A lápide é UNIONADA e aplicada SOBRE o `userAdded`. Sem isso a exclusão não
  // sobrevive ao sync: `userAdded` é união (o servidor não pode apagar o que
  // só existe num aparelho), então um imóvel excluído no PC1 voltava no load do
  // PC2. Filtrar depois de unir — e não antes — é o que importa: a lápide do
  // remoto tem que conseguir derrubar o `userAdded` do local, senão o aparelho
  // que já tinha o imóvel continua vendo.
  const deletedUserAdded = unionById(
    remote.deletedUserAdded,
    local.deletedUserAdded,
    (id) => id,
  );
  const lapide = new Set(deletedUserAdded);

  return {
    v: SNAPSHOT_VERSION,
    updatedAt: remote.updatedAt,
    removedIds: unionById(remote.removedIds, local.removedIds, (id) => id),
    userAdded: unionById(remote.userAdded, local.userAdded, idDeImovel).filter(
      (a) => {
        const id = idDeImovel(a);
        return id === null || !lapide.has(id);
      },
    ),
    deletedUserAdded,
    notes: unionById(remote.notes, local.notes, (n) => n.id),
    statuses: mesclarPorMaisNovo(local.statuses, remote.statuses, (s) => s.apartmentId),
    // remote por cima de local: a chave que o servidor conhece fica com o
    // valor dele, a que ele nunca viu sobrevive. A ordem das chaves fica a
    // do local — só muda quando o aparelho realmente tem algo a mais, e
    // nesse caso os dois documentos são mesmo diferentes.
    checklist: { ...local.checklist, ...remote.checklist },
    followUps: { ...local.followUps, ...remote.followUps },
  };
}

/** O documento não carrega nada que o dono tenha feito? */
function vazio(s: OwnerSnapshot): boolean {
  // `deletedUserAdded` conta como conteúdo. Um remoto que só carrega lápide
  // parece vazio por qualquer critério que olhasse só as listas visíveis — e
  // então a trava anti-apagão devolveria o local inteiro, jogando fora a
  // exclusão que o outro aparelho fez. Era o que o teste pegou.
  return (
    s.removedIds.length === 0 &&
    s.deletedUserAdded.length === 0 &&
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
    localStorage.setItem(
      USER_ADDED_REMOVED_KEY,
      JSON.stringify({
        version: USER_ADDED_REMOVED_VERSION,
        ids: s.deletedUserAdded,
      }),
    );
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
