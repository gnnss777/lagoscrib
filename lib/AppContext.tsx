"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { type Apartment } from "@/lib/data";
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

const defaultState: AppState = {
  isAuthenticated: false,
  username: null,
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
function buildLegacyUsers(): Record<string, string> {
  const users: Record<string, string> = {};
  const user = (process.env.NEXT_PUBLIC_APP_USER ?? (isDev ? "guinness" : "")).toLowerCase();
  const pass = process.env.NEXT_PUBLIC_APP_PASS ?? (isDev ? "curitiba2026" : "");
  // Fail-closed: sem usuário/senha configurados, ninguém entra (nem ""/"").
  if (user && pass) users[user] = pass;
  return users;
}
const USERS: Record<string, string> = buildLegacyUsers();

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount. Hidratação SSR-safe: localStorage só
  // existe no client; ler no initializer causaria hydration mismatch.
  // Aditivo v3 (kanban): migrateStoredState cobre v1 (sem version/checklist)
  // e v2 (sem followUps) — mesmos defaults, mesma chave.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const migrated = migrateStoredState(JSON.parse(stored));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- ver comentário acima
        setState((prev) => ({
          ...prev,
          ...migrated,
          version: CHECKLIST_STORAGE_VERSION,
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
