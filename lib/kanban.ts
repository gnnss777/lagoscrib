// Kanban de prospecção — núcleo puro e imutável (leva kanban-prospeccao).
// REGRA DO ESTÚDIO: UI apenas exibe estado; toda mutação passa por aqui.
// Nenhuma função muta o input — sempre retorna estruturas novas.
// Sem lib de drag: mover acontece por botões/menu/teclado chamando moveCard.

export type StatusType =
  | "novo"
  | "contactado"
  | "respondido"
  | "agendado"
  | "feita"
  | "negociacao"
  | "aprovado"
  | "recusado";

export interface ApartmentStatus {
  apartmentId: string;
  status: StatusType;
  updatedAt: string;
  scheduledDate?: string;
  /** Ordem dentro da coluna (fecha B5). Ausente = fim da coluna. */
  index?: number;
}

export type FollowUpStatus = "aguardando" | "retornou";

export interface FollowUp {
  attempts: number;
  status: FollowUpStatus;
  lastContactAt?: string;
}

/** Ordem do pipeline — fonte única das colunas (LL-006: nada hardcoded na UI). */
export const KANBAN_COLUMNS: StatusType[] = [
  "novo",
  "contactado",
  "respondido",
  "agendado",
  "feita",
  "negociacao",
  "aprovado",
  "recusado",
];

export const STATUS_LABELS: Record<StatusType, string> = {
  novo: "Não visitado",
  contactado: "Contactado",
  respondido: "Respondido",
  agendado: "Visita agendada",
  feita: "Visita feita",
  negociacao: "Em negociação",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export interface ColumnConfig {
  version: number;
  /** Ordem de exibição (subconjunto ordenado de KANBAN_COLUMNS). */
  order: StatusType[];
  /** Colunas ocultas por aba/config do cliente. */
  hidden: StatusType[];
  /** Rótulos customizados (parcial — resto cai no STATUS_LABELS). */
  labels: Partial<Record<StatusType, string>>;
}

export const KANBAN_COLUMNS_VERSION = 2;

export const DEFAULT_COLUMN_CONFIG: ColumnConfig = {
  version: KANBAN_COLUMNS_VERSION,
  order: [...KANBAN_COLUMNS],
  hidden: [],
  labels: {},
};

function isStatus(s: unknown): s is StatusType {
  return (
    typeof s === "string" &&
    (KANBAN_COLUMNS as string[]).includes(s)
  );
}

/**
 * Parse da config de colunas do cliente (chave `apartamentos-app-kanban-cols`).
 * Lixo/versão incompatível → default exato (nunca quebra o board).
 */
export function parseColumnConfig(raw: unknown): ColumnConfig {
  if (typeof raw !== "string") return { ...DEFAULT_COLUMN_CONFIG };
  try {
    const p = JSON.parse(raw) as Partial<ColumnConfig>;
    if (p?.version !== KANBAN_COLUMNS_VERSION) return { ...DEFAULT_COLUMN_CONFIG };
    const order = Array.isArray(p.order)
      ? p.order.filter(isStatus)
      : [...KANBAN_COLUMNS];
    const hidden = Array.isArray(p.hidden)
      ? p.hidden.filter(isStatus)
      : [];
    const labels: Partial<Record<StatusType, string>> = {};
    if (p.labels && typeof p.labels === "object") {
      for (const [k, v] of Object.entries(p.labels)) {
        if (isStatus(k) && typeof v === "string" && v.trim().length > 0) {
          labels[k] = v.trim().slice(0, 40);
        }
      }
    }
    return { version: KANBAN_COLUMNS_VERSION, order, hidden, labels };
  } catch {
    return { ...DEFAULT_COLUMN_CONFIG };
  }
}

export function columnLabel(status: StatusType, cfg: ColumnConfig): string {
  return cfg.labels[status] ?? STATUS_LABELS[status];
}

export interface KanbanColumn {
  status: StatusType;
  label: string;
  /** Ids ordenados por index (ausente = fim, estável por updatedAt). */
  ids: string[];
}

/** Agrupa statuses por coluna, na ordem da config, pulando ocultas. */
export function buildColumns(
  statuses: ApartmentStatus[],
  _followUps: Record<string, FollowUp>,
  cfg: ColumnConfig,
): KanbanColumn[] {
  const hidden = new Set(cfg.hidden);
  const order =
    cfg.order.length > 0 ? cfg.order : [...KANBAN_COLUMNS];
  return order
    .filter((s) => !hidden.has(s))
    .map((s) => ({
      status: s,
      label: columnLabel(s, cfg),
      ids: statuses
        .filter((e) => e.status === s)
        .sort((a, b) => {
          const ia = a.index ?? Number.MAX_SAFE_INTEGER;
          const ib = b.index ?? Number.MAX_SAFE_INTEGER;
          if (ia !== ib) return ia - ib;
          return a.updatedAt < b.updatedAt ? -1 : 1;
        })
        .map((e) => e.apartmentId),
    }));
}

/**
 * Trava física do board estático sem scroll (ESTÁTICO-SEM-SCROLL):
 * divide os ids da coluna em visíveis (até `cap`) + ocultos (resto vira
 * o rodapé "+N restantes"). Pura e imutável como o resto do núcleo.
 */
export function splitColumnOverflow(
  ids: string[],
  cap: number,
): { visible: string[]; hidden: string[] } {
  const n =
    typeof cap === "number" && Number.isFinite(cap)
      ? Math.max(0, Math.floor(cap))
      : 0;
  return { visible: ids.slice(0, n), hidden: ids.slice(n) };
}

function reindexColumn(
  entries: ApartmentStatus[],
  status: StatusType,
  now: string,
): ApartmentStatus[] {
  return entries
    .filter((e) => e.status === status)
    .sort((a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER))
    .map((e, i) =>
      e.index === i ? e : { ...e, index: i, updatedAt: e.updatedAt ?? now },
    );
}

export interface MoveOptions {
  /** Limpeza explícita da data (ação "limpar data"). Sem isso, a data é preservada (regressão B1). */
  clearDate?: boolean;
  /** Data nova (ex.: reagendar direto do board). */
  scheduledDate?: string;
  now?: string;
}

/**
 * Move um card entre colunas (ou reposiciona dentro da mesma).
 * Imutável: nunca toca no array de entrada. Reindexa só as colunas
 * afetadas. `scheduledDate` é preservada salvo `clearDate`/nova data.
 */
export function moveCard(
  prev: ApartmentStatus[],
  apartmentId: string,
  toStatus: StatusType,
  toIndex?: number,
  opts: MoveOptions = {},
): ApartmentStatus[] {
  const now = opts.now ?? new Date().toISOString();
  const current = prev.find((e) => e.apartmentId === apartmentId);
  const fromStatus = current?.status;

  // Data: nova > explícita-clear > preservada (B1).
  const scheduledDate =
    opts.scheduledDate !== undefined
      ? opts.scheduledDate || undefined
      : opts.clearDate
        ? undefined
        : current?.scheduledDate;

  const moved: ApartmentStatus = {
    apartmentId,
    status: toStatus,
    updatedAt: now,
    ...(scheduledDate ? { scheduledDate } : {}),
    index: -1, // placeholder, recalculado abaixo
  };

  // Remove a entrada antiga; demais entradas são copiadas (imutabilidade).
  const rest = prev
    .filter((e) => e.apartmentId !== apartmentId)
    .map((e) => ({ ...e }));

  const destCount = rest.filter((e) => e.status === toStatus).length;
  const at =
    toIndex === undefined
      ? destCount
      : Math.max(0, Math.min(toIndex, destCount));
  moved.index = at;

  // Empurra quem está em/meio à posição de destino.
  for (const e of rest) {
    if (e.status === toStatus && (e.index ?? destCount) >= at) {
      e.index = (e.index ?? destCount) + 1;
    }
  }

  const merged = [...rest, moved];
  const touched = new Set<StatusType>([toStatus]);
  if (fromStatus && fromStatus !== toStatus) touched.add(fromStatus);

  // Reindex sequencial só nas colunas tocadas.
  let out = merged;
  for (const s of touched) {
    const col = out
      .filter((e) => e.status === s)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((e, i) => ({ ...e, index: i }));
    const others = out.filter((e) => e.status !== s);
    out = [...others, ...col];
  }
  void reindexColumn;
  return out;
}

/** "Contatei": incrementa tentativas (só se ainda aguardando). */
export function markContactFollowUp(
  prev: Record<string, FollowUp>,
  apartmentId: string,
  now?: string,
): Record<string, FollowUp> {
  const at = now ?? new Date().toISOString();
  const cur = prev[apartmentId];
  if (cur?.status === "retornou") return prev;
  return {
    ...prev,
    [apartmentId]: {
      attempts: (cur?.attempts ?? 0) + 1,
      status: "aguardando",
      lastContactAt: at,
    },
  };
}

/** "Retornou ✓": fecha o loop preservando o histórico de tentativas. */
export function markReturnedFollowUp(
  prev: Record<string, FollowUp>,
  apartmentId: string,
): Record<string, FollowUp> {
  const cur = prev[apartmentId] ?? { attempts: 0, status: "aguardando" as const };
  return {
    ...prev,
    [apartmentId]: { ...cur, status: "retornou" },
  };
}

/** Pendente há mais que o limiar (dias) desde o último contato. */
export function isHanging(
  fu: FollowUp | undefined,
  thresholdDays: number,
  nowIso?: string,
): boolean {
  if (!fu || fu.status !== "aguardando") return false;
  if (!fu.lastContactAt) return true;
  const now = (nowIso ? new Date(nowIso) : new Date()).getTime();
  const last = new Date(fu.lastContactAt).getTime();
  if (Number.isNaN(last)) return true;
  return now - last > thresholdDays * 24 * 60 * 60 * 1000;
}

export function countHanging(
  followUps: Record<string, FollowUp>,
  thresholdDays: number,
  nowIso?: string,
): number {
  return Object.values(followUps).filter((f) =>
    isHanging(f, thresholdDays, nowIso),
  ).length;
}

// --- Migração aditiva v3 (padrão S004) ---

export interface StoredState {
  version: number;
  statuses: ApartmentStatus[];
  checklist: Record<string, string[]>;
  followUps: Record<string, FollowUp>;
  [k: string]: unknown;
}

/**
 * Hidrata qualquer estado salvo (v1 sem version → v3 atual).
 * Usado pelo AppContext no mount; testável em node (regressão AC-4).
 */
export function migrateStoredState(parsed: unknown): StoredState {
  const p =
    parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  const statuses = Array.isArray(p["statuses"])
    ? (p["statuses"] as ApartmentStatus[]).filter(
        (s) => s && typeof s.apartmentId === "string" && isStatus(s.status),
      )
    : [];
  const checklist =
    p["checklist"] && typeof p["checklist"] === "object"
      ? (p["checklist"] as Record<string, string[]>)
      : {};
  const followUps =
    p["followUps"] && typeof p["followUps"] === "object"
      ? (p["followUps"] as Record<string, FollowUp>)
      : {};
  return {
    ...(p as Record<string, unknown>),
    version: 3,
    statuses,
    checklist,
    followUps,
  } as StoredState;
}

// --- Contrato de sync (B3/B4: formato que o backend já aceita) ---

export interface SyncFollowUp {
  apartmentId: string;
  portal: string;
  urlOriginal?: string;
  attempts: number;
  status: FollowUpStatus;
  lastContactAt?: string | null;
}

/** Serializa o estado v3 no formato de `syncPushSchema.followUps`. */
export function toSyncFollowUps(
  followUps: Record<string, FollowUp>,
  portal = "zap",
): SyncFollowUp[] {
  return Object.entries(followUps).map(([apartmentId, f]) => ({
    apartmentId,
    portal,
    attempts: f.attempts,
    status: f.status,
    ...(f.lastContactAt ? { lastContactAt: f.lastContactAt } : {}),
  }));
}
