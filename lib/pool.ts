// Pool único de imóveis (fecha B2): estáticos (data.ts) + adicionados
// pelo usuário (localStorage). Dashboard e Kanban consomem a mesma função.
// SSR-safe: sem localStorage (servidor/node), retorna só os estáticos.
import {
  apartments as staticApartments,
  saleApartments as staticSaleApartments,
  type Apartment,
} from "@/lib/data";

/** Chave dos imóveis criados no AddApartmentForm (nunca tocar app-state). */
export const USER_ADDED_KEY = "apartamentos-app-new";

const STATIC_POOL: Apartment[] = [...staticApartments, ...staticSaleApartments];

export function getStaticPool(): Apartment[] {
  return STATIC_POOL;
}

/** Estáticos + usuário (com default `transaction: "aluguel"` — aditivo S001). */
export function getAllApartments(): Apartment[] {
  try {
    const ls =
      typeof localStorage === "undefined" ? null : localStorage.getItem(USER_ADDED_KEY);
    if (ls) {
      const parsed = JSON.parse(ls) as Apartment[];
      if (Array.isArray(parsed)) {
        const mine = parsed
          .filter((a) => a && typeof a.id === "string")
          .map((a) => ({ transaction: "aluguel" as const, ...a }));
        const byApartmentId = new Map<string, Apartment>();
        for (const apartment of [...STATIC_POOL, ...mine]) {
          byApartmentId.set(apartment.id, apartment);
        }
        return [...byApartmentId.values()];
      }
    }
  } catch {
    // ignore — cai para os estáticos
  }
  return STATIC_POOL;
}
