import type { Apartment } from "@/lib/data";

// Regra de transação (S006). Ausente = aluguel (aditivo S001).
// Pura — TDD RED→GREEN; UI (toggle) vai para e2e/venda.spec.ts.

export type TransactionTab = "alugar" | "comprar";

/** Venda explícita; todo o resto (incluindo legado sem campo) é aluguel. */
export function isSale(a: Pick<Apartment, "transaction">): boolean {
  return a.transaction === "venda";
}

/** Pool da aba ativa: Comprar só vendas; Alugar exclui vendas. */
export function filterByTransaction<T extends Pick<Apartment, "transaction">>(
  list: T[],
  tab: TransactionTab
): T[] {
  return list.filter((a) => (tab === "comprar" ? isSale(a) : !isSale(a)));
}

/** Sufixo do preço no card: "/mês" só no aluguel (AC-TOGGLE-01). */
export function priceSuffix(a: Pick<Apartment, "transaction">): string {
  return isSale(a) ? "" : "/mês";
}
