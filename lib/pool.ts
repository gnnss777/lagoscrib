// Pool único de imóveis (fecha B2): estáticos (base do perfil) + adicionados
// pelo usuário (localStorage). Dashboard e Kanban consomem a mesma função.
// SSR-safe: sem localStorage (servidor/node), retorna só os estáticos.
//
// Os estáticos vêm de "@/lib/base" (ver aquele arquivo): o next.config.js escolhe
// a base do deploy por NEXT_PUBLIC_PERFIL — "thais" usa lib/data-thais.ts, sem a
// env usa lib/data.ts (dono). Só o dado muda; o tipo continua vindo de
// "@/lib/data", que é o schema comum das duas bases geradas.
import {
  apartments as staticApartments,
  saleApartments as staticSaleApartments,
} from "@/lib/base";
import type { Apartment } from "@/lib/data";
import {
  REMOVED_IDS_STORAGE_KEY,
  REMOVED_IDS_STORAGE_VERSION,
} from "@/lib/constants";

/** Chave dos imóveis criados no AddApartmentForm (nunca tocar app-state). */
export const USER_ADDED_KEY = "apartamentos-app-new";

const STATIC_POOL: Apartment[] = [...staticApartments, ...staticSaleApartments];

export function getStaticPool(): Apartment[] {
  return STATIC_POOL;
}

function getRemovedIds(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const stored = localStorage.getItem(REMOVED_IDS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as { version?: unknown; ids?: unknown };
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.version !== REMOVED_IDS_STORAGE_VERSION ||
      !Array.isArray(parsed.ids)
    ) {
      return [];
    }
    return parsed.ids.filter((id: unknown): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

/** Estáticos + usuário (com default `transaction: "aluguel"` — aditivo S001). */
export function getAllApartments(): Apartment[] {
  const removedIds = new Set(getRemovedIds());
  const mine: Apartment[] = [];
  try {
    const stored =
      typeof localStorage === "undefined" ? null : localStorage.getItem(USER_ADDED_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Apartment[];
      if (Array.isArray(parsed)) {
        mine.push(
          ...parsed
            .filter((a) => a && typeof a.id === "string")
            .map((a) => ({ transaction: "aluguel" as const, ...a })),
        );
      }
    }
  } catch {
    // ignore — cai para os estáticos
  }
  const byApartmentId = new Map<string, Apartment>();
  for (const apartment of [...STATIC_POOL, ...mine]) {
    if (!removedIds.has(apartment.id)) {
      byApartmentId.set(apartment.id, apartment);
    }
  }
  return [...byApartmentId.values()];
}
