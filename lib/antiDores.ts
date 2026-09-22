import {
  CHECKLIST_ITEMS,
  CURRENCY_CODE,
  CURRENCY_LOCALE,
  DEPOSIT_MONTHS,
  ENTRY_MONTHS_MIN,
  MOVING_COST_RANGES,
  WHATSAPP_QUESTIONS,
} from "./constants";

// Lógica pura anti-dores (S004). Sem I/O, sem DOM — testável em vitest.
// Valores/faixas vêm de lib/constants.ts (LL-006); aqui só o comportamento.

export function formatBRL(value: number): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency: CURRENCY_CODE,
    minimumFractionDigits: 0,
  }).format(value);
}

export interface ConfirmInput {
  title: string;
  neighborhood: string;
  rent: number;
  condo: number;
  condoUnknown?: boolean;
  pets?: string;
  total: number;
  link: string;
}

/** Mensagem de confirmação anti-ghost com as 4 perguntas (AC-WA-01). */
export function buildWhatsAppConfirm(a: ConfirmInput): string {
  const condoLine = a.condoUnknown
    ? "a confirmar (não informado no anúncio)"
    : `${formatBRL(a.condo)} no anúncio`;
  const petsLine = a.pets ? ` (no anúncio: ${a.pets})` : "";
  const [q1, q2, q3, q4] = WHATSAPP_QUESTIONS;
  return (
    `Olá! Vi o anúncio "${a.title}" (${a.neighborhood} — ` +
    `${formatBRL(a.total)}/mês) e gostaria de confirmar antes de visitar:\n` +
    `1. ${q1}\n` +
    `2. ${q2} (no anúncio: ${condoLine})\n` +
    `3. ${q3}${petsLine}\n` +
    `4. ${q4}\n` +
    `Link do anúncio: ${a.link}`
  );
}

/**
 * Link de compartilhamento wa.me (sem número — telefones são mascarados
 * nos portais; o usuário escolhe o contato. Nunca inventar número).
 */
export function buildWhatsAppLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Faixa de custo de mudança por nº de quartos (estimativa — ver constants). */
export function buildMovelCost(bedrooms: number): { min: number; max: number } {
  const range =
    MOVING_COST_RANGES.find(
      (r) => bedrooms >= r.minRooms && bedrooms <= r.maxRooms
    ) ?? MOVING_COST_RANGES[MOVING_COST_RANGES.length - 1];
  return { min: range.min, max: range.max };
}

/**
 * Faixa de entrada estimada (aluguel): mín = 1º mês (fiador, sem custo
 * inicial) → máx = 1º mês + caução (DEPOSIT_MONTHS×). Para venda, sem
 * estimativa honesta sem simular financiamento — retorna null.
 */
export function buildEntryEstimate(input: {
  transaction?: "aluguel" | "venda";
  rent: number;
}): { min: number; max: number } | null {
  if (input.transaction === "venda") return null;
  return {
    min: input.rent * ENTRY_MONTHS_MIN,
    max: input.rent * (ENTRY_MONTHS_MIN + DEPOSIT_MONTHS),
  };
}

/** Texto exportável do checklist (copiar/WhatsApp): nome + valores + itens. */
export function buildChecklistText(
  apartment: { title: string; total: number; link: string },
  checkedIds: string[],
  allIds?: string[]
): string {
  const ids = allIds ?? CHECKLIST_ITEMS.map((i) => i.id);
  const labelOf = (id: string) =>
    CHECKLIST_ITEMS.find((i) => i.id === id)?.label ?? id;
  const lines = ids.map(
    (id) => `${checkedIds.includes(id) ? "[x]" : "[ ]"} ${labelOf(id)}`
  );
  return (
    `Checklist de visita — ${apartment.title}\n` +
    `Custo total: ${formatBRL(apartment.total)}/mês\n` +
    `${lines.join("\n")}\n` +
    `Link do anúncio: ${apartment.link}`
  );
}
