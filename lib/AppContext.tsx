"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { type Apartment } from "@/lib/data";
import { buildLegacyUsers } from "@/lib/legacy-users";
import {
  CHECKLIST_STORAGE_VERSION,
  REMOVED_IDS_STORAGE_KEY,
  REMOVED_IDS_STORAGE_VERSION,
} from "@/lib/constants";
import {
  KANBAN_COLUMNS,
  STATUS_LABELS,
  migrateStoredState,
  moveCard,
  markContactFollowUp,
  markReturnedFollowUp,
  type ApartmentStatus,
  type FollowUp,
  type StatusType,
} from "@/lib/kanban";
import {
  applySnapshot,
  buildSnapshot,
  clearSyncToken,
  reconcileOnLoad,
  pullSnapshot,
  pushSnapshot,
  readSyncToken,
  samePayload,
  writeSyncToken,
  type OwnerSnapshot,
  type SyncStatus,
} from "@/lib/ownerState";
import { SYNC_DEBOUNCE_MS, SYNC_POLL_MS } from "@/lib/constants";

// Re-exports (back-compat): STATUS_LABELS/StatusType moram em lib/kanban.ts
// (fonte única das colunas, LL-006). Importadores existentes não quebram.
export { KANBAN_COLUMNS, STATUS_LABELS, type StatusType, type FollowUp };
export type { ApartmentStatus };

export interface Note {
  id: string;
  apartmentId: string;
  text: string;
  createdAt: string;
}

interface AppState {
  isAuthenticated: boolean;
  username: string | null;
  notes: Note[];
  statuses: ApartmentStatus[];
  // Checklist de visita (S004, ADR-002 decisão 2): mesma chave, schema aditivo.
  // Follow-up do corretor (kanban): idem. Estados v1/v2 continuam legíveis.
  version: number;
  checklist: Record<string, string[]>;
  followUps: Record<string, FollowUp>;
}

interface AppContextValue extends AppState {
  login: (username: string, password: string) => boolean;
  logout: () => void;
  /** Sincroniza sessão do NextAuth (backend) com o estado local. */
  setSessionUser: (username: string | null) => void;
  /* Sync entre dispositivos (lib/ownerState): o código é digitado uma vez por
     dispositivo e nunca vai para o bundle — se fosse NEXT_PUBLIC_, qualquer
     pessoa que abrisse o app leria e poderia reescrever o estado do dono. */
  syncStatus: SyncStatus;
  syncEnabled: boolean;
  enableSync: (token: string) => void;
  disableSync: () => void;
  addApartment: (apartment: Apartment) => void;
  /** Remove imóvel da visualização local. */
  removeApartment: (apartmentId: string) => void;
  addNote: (apartmentId: string, text: string) => void;
  updateStatus: (
    apartmentId: string,
    status: StatusType,
    scheduledDate?: string | null,
    toIndex?: number,
  ) => void;
  /** Move o card para outra posição (mesma coluna = reordenar). */
  moveCardTo: (apartmentId: string, toStatus: StatusType, toIndex?: number) => void;
  getStatus: (apartmentId: string) => StatusType;
  getStatusEntry: (apartmentId: string) => ApartmentStatus | undefined;
  getNotes: (apartmentId: string) => Note[];
  toggleChecklistItem: (apartmentId: string, itemId: string) => void;
  getChecklist: (apartmentId: string) => string[];
  /** "Contatei o corretor": incrementa tentativas (só se aguardando). */
  markContact: (apartmentId: string) => void;
  /** "Retornou ✓": fecha o loop preservando o histórico. */
  markReturned: (apartmentId: string) => void;
  getFollowUp: (apartmentId: string) => FollowUp | undefined;
}

// Bypass do gate client-side: o app abre direto no Dashboard, sem digitar
// usuário/senha. LIGADO por padrão (NEXT_PUBLIC_* é embutido no bundle no
// build, então default-on é o que funciona sem mexer no painel da Vercel);
// opt-out com NEXT_PUBLIC_OPEN_ACCESS=0. Login continua disponível ("Sair"
// no cabeçalho leva ao LoginPage). NÃO afeta a API: /api/* segue exigindo
// sessão (requireAuth/auth) — o Dashboard não consome essas rotas, é
// client-side.
// Declarado aqui ANTES de defaultState: usa OPEN_ACCESS abaixo, e `const` na
// zona morta temporal derrubava o app com ReferenceError em dev.
const OPEN_ACCESS = process.env.NEXT_PUBLIC_OPEN_ACCESS !== "0";
const OPEN_ACCESS_USER = process.env.NEXT_PUBLIC_OPEN_ACCESS_USER ?? "local";

const defaultState: AppState = {
  isAuthenticated: OPEN_ACCESS,
  username: OPEN_ACCESS ? OPEN_ACCESS_USER : null,
  notes: [],
  statuses: [],
  version: CHECKLIST_STORAGE_VERSION,
  checklist: {},
  followUps: {},
};

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEY = "apartamentos-app-state";

// Modo legado (pré-backend): auth client-side — NÃO é barreira real.
// Em produção os fallbacks são removidos (fail-closed); com backend
// configurado este mapa nem é usado (NextAuth assume — ver lib/auth.ts).
const isDev = process.env.NODE_ENV !== "production";
if (isDev) {
  console.warn("[auth] modo legado local ativo — migrar para backend (NextAuth)");
}
// O mapa de credenciais vive em lib/legacy-users.ts porque o authorize do
// NextAuth precisa do MESMO par para validar a senha e assinar a sessão das
// rotas /api/*; duas cópias divergiriam e o login aceitaria no cliente e
// recusaria no servidor.
const USERS: Record<string, string> = buildLegacyUsers();

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [isHydrated, setIsHydrated] = useState(false);
  // Sync entre dispositivos (lib/ownerState). `null` = desligado neste
  // dispositivo; o dono liga digitando o código uma vez (SyncGate).
  const [syncToken, setSyncToken] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("off");
  // O push só liga DEPOIS do pull: senão um dispositivo novo empurraria o
  // documento vazio por cima do estado bom do dono.
  const [syncReady, setSyncReady] = useState(false);
  // Última carga que este aparelho sincronizou (puxada ou empurrada), sem
  // `updatedAt` — é a base do "isso mudou de verdade?".
  const lastSyncedRef = useRef<OwnerSnapshot | null>(null);

  // Load from localStorage on mount. Hidratação SSR-safe: localStorage só
  // existe no client; ler no initializer causaria hydration mismatch.
  // Aditivo v3 (kanban): migrateStoredState cobre v1 (sem version/checklist)
  // e v2 (sem followUps) — mesmos defaults, mesma chave.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const migrated = migrateStoredState(JSON.parse(stored));
        // StoredState tem índice [k: string]: unknown e não declara auth, então
        // estreita aqui. Só aceita literal `true` (fail-closed, como o resto do
        // arquivo): truthy vindo de storage não autentica ninguém.
        const savedAuth = migrated["isAuthenticated"] === true;
        const savedUser = typeof migrated["username"] === "string" ? migrated["username"] : null;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- ver comentário acima
        setState((prev) => ({
          ...prev,
          ...migrated,
          version: CHECKLIST_STORAGE_VERSION,
          // Bypass não pode ser sobrescrito por um estado antigo salvo no
          // localStorage (quem já deu "Sair" ficaria preso no LoginPage).
          // Base no estado salvo (`savedAuth`), não em `prev` (que é o
          // defaultState): usar prev apagava o login salvo em todo load, e o
          // reload voltava para a tela de login.
          isAuthenticated: savedAuth || OPEN_ACCESS,
          username: savedAuth ? savedUser : OPEN_ACCESS_USER,
        }));
      }
    } catch {
      // ignore
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isHydrated]);

  /* ------------------------------------------------------- sync entre PCs */

  // Aplica um documento vindo do servidor nas três chaves que o dono mexe, e
  // grava no localStorage. Extraído porque o pull do mount e o pull do poll
  // adotam exatamente do mesmo jeito — duas cópias divergem na primeira vez
  // que alguém acrescenta um campo.
  const adotaRemoto = useCallback((winner: OwnerSnapshot) => {
    applySnapshot(winner);
    setState((prev) => ({
      ...prev,
      notes: winner.notes,
      // `scheduledDate` chega como `string | null` (o schema tolera null de
      // versões antigas) e o tipo do app é `string | undefined` — a limpeza
      // em moveCard remove o campo, então null vira undefined.
      statuses: winner.statuses.map((s) => ({
        ...s,
        scheduledDate: s.scheduledDate ?? undefined,
      })),
      checklist: winner.checklist,
      // `lastContactAt` idem: null no schema, `string | undefined` no app.
      followUps: Object.fromEntries(
        Object.entries(winner.followUps).map(([id, f]) => [
          id,
          { ...f, lastContactAt: f.lastContactAt ?? undefined },
        ]),
      ),
    }));
  }, []);

  // Monta: lê o token e puxa o documento do dono. Roda depois da hidratação
  // do localStorage, senão o merge compararia um local vazio com o remoto.
  useEffect(() => {
    if (!isHydrated) return;
    const token = readSyncToken();
    // Sem token, o estado inicial já é o certo ("off"/null) — setar aqui seria
    // ruído e forçaria um segundo render.
    if (!token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação pós-mount de preferência de aparelho, mesmo padrão do efeito de localStorage acima
    setSyncToken(token);
    let cancelled = false;
    setSyncStatus("syncing");
    void (async () => {
      const { ok, snapshot, reason } = await pullSnapshot(token);
      if (cancelled) return;
      if (!ok) {
        setSyncStatus(reason === "Código inválido" ? "denied" : "error");
        setSyncReady(true);
        return;
      }
      const local = buildSnapshot();
      const { snapshot: winner, adoptedRemote } = reconcileOnLoad(local, snapshot);
      if (adoptedRemote && snapshot) {
        adotaRemoto(winner);
      } else {
        // Servidor vazio (primeira vez): o local vira a base. Numa carga com
        // servidor preenchido isto nunca roda — reconcileOnLoad sempre adota o
        // remoto, senão o aparelho novo sobe o estado vazio e apaga o dono.
        await pushSnapshot(token, winner);
      }
      if (cancelled) return;
      // Qual dos dois venceu, é o que este aparelho passa a considerar em
      // sincronia — é o que impede o push-gratuito de apagar a mudança de outro.
      lastSyncedRef.current = winner;
      setSyncStatus("idle");
      setSyncReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, adotaRemoto]);

  // Push com debounce. O snapshot é montado na hora (lê as 3 chaves), não do
  // estado React, porque removidos e imóveis adicionados vivem fora do
  // AppContext.
  //
  // Guarda a última carga que este aparelho sincronizou e só empurra quando o
  // documento realmente mudou. Sem essa checagem, um aparelho que só ABRE o app
  // dispara um push do estado vazio no primeiro tique do debounce e, como o
  // merge é last-write-wins, apaga o que o dono mexeu no outro aparelho. Foi
  // exatamente o que o teste de dois PCs pegou: o PC2 abriu depois do PC1
  // excluir e sobrescreveu a exclusão com `removedIds: []`.
  useEffect(() => {
    if (!isHydrated || !syncReady || !syncToken) return;
    const t = setTimeout(() => {
      const snapshot = buildSnapshot();
      if (samePayload(lastSyncedRef.current, snapshot)) return;
      setSyncStatus("syncing");
      void pushSnapshot(syncToken, snapshot).then((r) => {
        if (r.ok) lastSyncedRef.current = snapshot;
        setSyncStatus(r.ok ? "idle" : "error");
      });
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [state, isHydrated, syncReady, syncToken]);

  // Pull periódico + ao voltar pra aba.
  //
  // O push é de um lado só: o dono mexe no PC1, o PC2 continua aberto e não faz
  // nada. Sem este efeito o outro aparelho só descobre a mudança recarregando a
  // página — que era o sintoma relatado. O foco/visibility dá o quase-imediato
  // (o dono volta pra uma aba que estava em background e já vê o card movido);
  // o intervalo cobre a aba que fica na frente o tempo todo.
  useEffect(() => {
    if (!isHydrated || !syncReady || !syncToken) return;
    let cancelled = false;

    const puxar = async () => {
      // Trava do last-write-wins: se este aparelho tem mudança local que ainda
      // não subiu, NÃO adota o remoto. O push com debounce tem prioridade, e
      // adotar aqui devolveria ao dono uma edição que ele acabou de fazer.
      if (!samePayload(lastSyncedRef.current, buildSnapshot())) return;
      const { ok, snapshot } = await pullSnapshot(syncToken);
      if (cancelled || !ok || !snapshot) return;
      // Nada mudou no servidor desde a última carga deste aparelho.
      if (samePayload(lastSyncedRef.current, snapshot)) return;
      // Mudou aqui no meio da ida: de novo, a edição local vence.
      if (!samePayload(lastSyncedRef.current, buildSnapshot())) return;
      adotaRemoto(snapshot);
      lastSyncedRef.current = snapshot;
    };

    const t = setInterval(() => void puxar(), SYNC_POLL_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void puxar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [isHydrated, syncReady, syncToken, adotaRemoto]);

  const enableSync = useCallback((token: string) => {    if (!token.trim()) return;
    writeSyncToken(token);
    setSyncToken(token.trim());
    setSyncReady(false);
    setSyncStatus("syncing");
  }, []);

  const disableSync = useCallback(() => {
    clearSyncToken();
    setSyncToken(null);
    setSyncReady(false);
    setSyncStatus("off");
  }, []);

  const login = useCallback((username: string, password: string): boolean => {
    if (USERS[username.toLowerCase()] === password) {
      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        username: username.toLowerCase(),
      }));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isAuthenticated: false,
      username: null,
    }));
  }, []);

  const setSessionUser = useCallback((username: string | null) => {
    setState((prev) => ({
      ...prev,
      isAuthenticated: username !== null,
      username,
    }));
  }, []);

  const addApartment = useCallback((apartment: import("@/lib/data").Apartment) => {
    setState((prev) => ({
      ...prev,
      // Em uma implementação real, adicionaríamos ao array de apartamentos no componente, mas como o contexto não armazena a lista completa de apartamentos (o Dashboard usa data.ts), vamos apenas registrar um log.
    }));
    // Como o contexto atual não armazena apartamentos (usa data.ts estático), vamos usar localStorage para persistir novos
    try {
      const stored = localStorage.getItem("apartamentos-app-new");
      const list: (Apartment & { createdAt?: string })[] = stored
        ? JSON.parse(stored)
        : [];
      const byApartmentId = new Map<
        string,
        Apartment & { createdAt?: string }
      >();
      for (const item of list) byApartmentId.set(item.id, item);
      byApartmentId.set(apartment.id, {
        ...apartment,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(
        "apartamentos-app-new",
        JSON.stringify([...byApartmentId.values()]),
      );
    } catch {
      // ignore
    }
  }, []);

  const removeApartment = useCallback((apartmentId: string) => {
    if (apartmentId.startsWith("new-")) {
      try {
        const stored = localStorage.getItem("apartamentos-app-new");
        const list: import("@/lib/data").Apartment[] = stored ? JSON.parse(stored) : [];
        localStorage.setItem(
          "apartamentos-app-new",
          JSON.stringify(list.filter((a) => a.id !== apartmentId)),
        );
      } catch {
        // ignore
      }
    } else {
      try {
        const stored = localStorage.getItem(REMOVED_IDS_STORAGE_KEY);
        const parsed = stored
          ? (JSON.parse(stored) as { version?: unknown; ids?: unknown })
          : null;
        const ids =
          parsed &&
          typeof parsed === "object" &&
          parsed.version === REMOVED_IDS_STORAGE_VERSION &&
          Array.isArray(parsed.ids)
            ? parsed.ids.filter((id: unknown): id is string => typeof id === "string")
            : [];
        localStorage.setItem(
          REMOVED_IDS_STORAGE_KEY,
          JSON.stringify({
            version: REMOVED_IDS_STORAGE_VERSION,
            ids: ids.includes(apartmentId) ? ids : [...ids, apartmentId],
          }),
        );
      } catch {
        // ignore
      }
    }
    // Limpa também estado órfão (status/notas/checklist/follow-up).
    setState((prev) => ({
      ...prev,
      statuses: prev.statuses.filter((s) => s.apartmentId !== apartmentId),
      notes: prev.notes.filter((n) => n.apartmentId !== apartmentId),
      checklist: Object.fromEntries(
        Object.entries(prev.checklist).filter(([id]) => id !== apartmentId),
      ),
      followUps: Object.fromEntries(
        Object.entries(prev.followUps).filter(([id]) => id !== apartmentId),
      ),
    }));
  }, []);

  const addNote = useCallback((apartmentId: string, text: string) => {
    const note: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      apartmentId,
      text,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      notes: [note, ...prev.notes],
    }));
  }, []);

  const updateStatus = useCallback(
    (
      apartmentId: string,
      status: StatusType,
      scheduledDate?: string | null,
      toIndex?: number,
    ) => {
      // B1: undefined = preserva a data existente; null = limpeza explícita;
      // string = nova data. moveCard resolve via lib/kanban.ts (imutável).
      setState((prev) => ({
        ...prev,
        statuses: moveCard(prev.statuses, apartmentId, status, toIndex, {
          ...(scheduledDate === undefined
            ? {}
            : scheduledDate === null
              ? { clearDate: true }
              : { scheduledDate }),
        }),
      }));
    },
    []
  );

  const moveCardTo = useCallback(
    (apartmentId: string, toStatus: StatusType, toIndex?: number) => {
      setState((prev) => ({
        ...prev,
        statuses: moveCard(prev.statuses, apartmentId, toStatus, toIndex),
      }));
    },
    []
  );

  const markContact = useCallback((apartmentId: string) => {
    setState((prev) => ({
      ...prev,
      followUps: markContactFollowUp(prev.followUps, apartmentId),
    }));
  }, []);

  const markReturned = useCallback((apartmentId: string) => {
    setState((prev) => ({
      ...prev,
      followUps: markReturnedFollowUp(prev.followUps, apartmentId),
    }));
  }, []);

  const getFollowUp = useCallback(
    (apartmentId: string): FollowUp | undefined => {
      return state.followUps[apartmentId];
    },
    [state.followUps]
  );

  const getStatus = useCallback(
    (apartmentId: string): StatusType => {
      const found = state.statuses.find((s) => s.apartmentId === apartmentId);
      return found?.status ?? "novo";
    },
    [state.statuses]
  );

  const getStatusEntry = useCallback(
    (apartmentId: string): ApartmentStatus | undefined => {
      return state.statuses.find((s) => s.apartmentId === apartmentId);
    },
    [state.statuses]
  );

  const getNotes = useCallback(
    (apartmentId: string): Note[] => {
      return state.notes.filter((n) => n.apartmentId === apartmentId);
    },
    [state.notes]
  );

  const toggleChecklistItem = useCallback(
    (apartmentId: string, itemId: string) => {
      setState((prev) => {
        const current = prev.checklist[apartmentId] ?? [];
        const next = current.includes(itemId)
          ? current.filter((id) => id !== itemId)
          : [...current, itemId];
        return {
          ...prev,
          checklist: { ...prev.checklist, [apartmentId]: next },
        };
      });
    },
    []
  );

  const getChecklist = useCallback(
    (apartmentId: string): string[] => {
      return state.checklist[apartmentId] ?? [];
    },
    [state.checklist]
  );

  return (
    <AppContext.Provider
      value={{
        ...state,
        login,
        logout,
        setSessionUser,
        syncStatus,
        syncEnabled: syncToken !== null,
        enableSync,
        disableSync,
        addApartment,
        removeApartment,
        addNote,
        updateStatus,
        moveCardTo,
        getStatus,
        getStatusEntry,
        getNotes,
        toggleChecklistItem,
        getChecklist,
        markContact,
        markReturned,
        getFollowUp,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- flag SSR-safe padrão: evita mismatch entre HTML do servidor e primeiro render do client.
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

// STATUS_LABELS/KANBAN_COLUMNS re-exportados do topo (fonte única: lib/kanban.ts).
