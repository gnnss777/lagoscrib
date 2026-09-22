import type { Apartment } from "@/lib/data";
import { COMPARE_MAX } from "@/lib/constants";

// Núcleo puro da comparação (S005). Sem React, sem DOM — TDD RED→GREEN.
// Tabela/modal vão para o Playwright (e2e/comparacao.spec.ts).

/** Custo total efetivo: aluguel = total all-in mensal; venda = preço. */
export function effectiveTotal(a: Apartment): number {
  if (a.transaction === "venda") return a.salePrice ?? a.total;
  return a.total;
}

/** Ordem default da tabela: custo total efetivo crescente. */
export function sortCompareByTotalEffective(list: Apartment[]): Apartment[] {
  return [...list].sort((x, y) => effectiveTotal(x) - effectiveTotal(y));
}

export interface ToggleCompareResult {
  selected: string[];
  blocked: boolean;
}

/**
 * Liga/desliga um imóvel na seleção. Existente sempre sai; novo acima de
 * COMPARE_MAX bloqueia (5º) sem alterar a lista — a UI mostra o aviso.
 */
export function toggleCompareSelection(
  selected: string[],
  id: string
): ToggleCompareResult {
  if (selected.includes(id)) {
    return { selected: selected.filter((s) => s !== id), blocked: false };
  }
  if (selected.length >= COMPARE_MAX) {
    return { selected, blocked: true };
  }
  return { selected: [...selected, id], blocked: false };
}

/** Flags honestas derivadas do dado (ausente = sem flag, nunca "—" aqui). */
export function buildCompareFlags(a: Apartment): string[] {
  const flags: string[] = [];
  if (a.parking === 0) flags.push("sem garagem");
  if (
    a.features.some((f) =>
      f.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("sem elevador")
    )
  )
    flags.push("sem elevador");
  if (a.condoUnknown) flags.push("cond a confirmar");
  return flags;
}
