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
}

interface AppContextValue extends AppState {
  login: (username: string, password: string) => boolean;
  logout: () => void;
  addApartment: (apartment: Apartment) => void;
  addNote: (apartmentId: string, text: string) => void;
  updateStatus: (apartmentId: string, status: StatusType, scheduledDate?: string) => void;
  getStatus: (apartmentId: string) => StatusType;
  getNotes: (apartmentId: string) => Note[];
}

const defaultState: AppState = {
  isAuthenticated: false,
  username: null,
  notes: [],
  statuses: [],
};

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEY = "apartamentos-app-state";

const USERS: Record<string, string> = {
  // Credenciais via ambiente (.env.local) — fallbacks só para dev local.
  // Auth é client-side (não é barreira real); ver docs/ADR-001-pipeline.md.
  [(process.env.NEXT_PUBLIC_APP_USER ?? "guinness").toLowerCase()]:
    process.env.NEXT_PUBLIC_APP_PASS ?? "curitiba2026",
  admin: process.env.NEXT_PUBLIC_ADMIN_PASS ?? "admin123",
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setState((prev) => ({ ...prev, ...parsed }));
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

  return (
    <AppContext.Provider
      value={{
        ...state,
        login,
        logout,
        addApartment,
        addNote,
        updateStatus,
        getStatus,
        getNotes,
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
