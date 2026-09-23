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
import { CHECKLIST_STORAGE_VERSION } from "@/lib/constants";

export type StatusType =
  | "novo"
  | "agendado"
  | "feita"
  | "negociacao"
  | "aprovado"
  | "recusado";

export interface Note {
  id: string;
  apartmentId: string;
  text: string;
  createdAt: string;
}

export interface ApartmentStatus {
  apartmentId: string;
  status: StatusType;
  updatedAt: string;
  scheduledDate?: string;
}

interface AppState {
  isAuthenticated: boolean;
  username: string | null;
  notes: Note[];
  statuses: ApartmentStatus[];
  // Checklist de visita (S004, ADR-002 decisão 2): mesma chave, schema aditivo.
  // Estados v1 (sem version/checklist) continuam legíveis — defaults cobrem.
  version: number;
  checklist: Record<string, string[]>;
}

interface AppContextValue extends AppState {
  login: (username: string, password: string) => boolean;
  logout: () => void;
  /** Sincroniza sessão do NextAuth (backend) com o estado local. */
  setSessionUser: (username: string | null) => void;
  addApartment: (apartment: Apartment) => void;
  addNote: (apartmentId: string, text: string) => void;
  updateStatus: (apartmentId: string, status: StatusType, scheduledDate?: string) => void;
  getStatus: (apartmentId: string) => StatusType;
  getNotes: (apartmentId: string) => Note[];
  toggleChecklistItem: (apartmentId: string, itemId: string) => void;
  getChecklist: (apartmentId: string) => string[];
}

const defaultState: AppState = {
  isAuthenticated: false,
  username: null,
  notes: [],
  statuses: [],
  version: CHECKLIST_STORAGE_VERSION,
  checklist: {},
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
  // Aditivo v2 (S004): estados v1 sem version/checklist ganham os defaults.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- ver comentário acima
        setState((prev) => ({
          ...prev,
          ...parsed,
          version: CHECKLIST_STORAGE_VERSION,
          checklist: parsed.checklist ?? {},
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
      const list = stored ? JSON.parse(stored) : [];
      list.push({ ...apartment, createdAt: new Date().toISOString() });
      localStorage.setItem("apartamentos-app-new", JSON.stringify(list));
    } catch {
      // ignore
    }
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
    (apartmentId: string, status: StatusType, scheduledDate?: string) => {
      const statusEntry: ApartmentStatus = {
        apartmentId,
        status,
        updatedAt: new Date().toISOString(),
        scheduledDate,
      };
      setState((prev) => {
        const existing = prev.statuses.filter((s) => s.apartmentId !== apartmentId);
        return {
          ...prev,
          statuses: [...existing, statusEntry],
        };
      });
    },
    []
  );

  const getStatus = useCallback(
    (apartmentId: string): StatusType => {
      const found = state.statuses.find((s) => s.apartmentId === apartmentId);
      return found?.status ?? "novo";
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
        addNote,
        updateStatus,
        getStatus,
        getNotes,
        toggleChecklistItem,
        getChecklist,
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

export const STATUS_LABELS: Record<StatusType, string> = {
  novo: "Não visitado",
  agendado: "Visita agendada",
  feita: "Visita feita",
  negociacao: "Em negociação",
  aprovado: "Aprovado",
  recusado: "Recusado",
};
