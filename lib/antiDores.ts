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
  iptu?: number;
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  /** Como o anúncio trata garantia: "fiador", "seguro-fiança", "caução". */
  guarantor?: string;
}

/**
 * Mensagem de confirmação anti-ghost (AC-WA-01). Pede visita AMANHÃ e leva
 * junto os valores do anúncio, para o corretor corrigir o que estiver errado
 * em vez de responder "pode conferir?".
 *
 * "amanhã" é literal, não data calculada: a mensagem é montada no render
 * (SSR incluído) e `new Date()` aqui causaria hydration mismatch na virada do
 * dia, além de o fuso do broker ser outro.
 */
export function buildWhatsAppConfirm(a: ConfirmInput): string {
  const condo = a.condoUnknown ? "a confirmar" : formatBRL(a.condo);
  const iptu = a.iptu ? formatBRL(a.iptu) : "a confirmar";
  const pets = a.pets ? ` (no anúncio: ${a.pets})` : "";
  const fiador = a.guarantor ? ` (no anúncio: ${a.guarantor})` : "";
  const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);
  const specs = [
    a.bedrooms ? `${a.bedrooms} ${plural(a.bedrooms, "quarto", "quartos")}` : null,
    a.bathrooms
      ? `${a.bathrooms} ${plural(a.bathrooms, "banheiro", "banheiros")}`
      : null,
    a.area ? `${a.area}m²` : null,
    a.parking ? `${a.parking} ${plural(a.parking, "vaga", "vagas")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const [q1, q2, q3, q4, q5, q6, q7] = WHATSAPP_QUESTIONS;
  return (
    `Olá! Vi o anúncio "${a.title}" e gostaria de marcar uma visita AMANHÃ.\n\n` +
    `O que o anúncio informa:\n` +
    `• Aluguel: ${formatBRL(a.rent)}\n` +
    `• Condomínio: ${condo}\n` +
    `• IPTU: ${iptu}\n` +
    `• Total: ${formatBRL(a.total)}/mês\n` +
    `• ${a.neighborhood}${specs ? ` — ${specs}` : ""}\n\n` +
    `Antes da visita, poderia me confirmar:\n` +
    `1. ${q1}\n` +
    `2. ${q2} (no anúncio: ${condo})\n` +
    `3. ${q3}\n` +
    `4. ${q4}\n` +
    `5. ${q5}\n` +
    `6. ${q6}${fiador}\n` +
    `7. ${q7}${pets}\n\n` +
    `Consigo amanhã de manhã ou à tarde — qual horário fica melhor?\n` +
    `Link do anúncio: ${a.link}`
  );
}

/**
 * Link wa.me com o número do anúncio. Normaliza telefone BR:
 * - strip não-dígitos; descarta mascarado (*) → fallback sem número
 * - 10-11 dígitos sem DDI → prefixa 55; já com 55 usa direto
 * - mensagem sempre incluída (mesmo no fallback sem número)
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const fallback = `https://wa.me/?text=${encodeURIComponent(message)}`;
  if (!phone || phone.includes("*")) return fallback;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return fallback;
  if (/^55\d{10,11}$/.test(digits)) {
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }
  if (digits.length >= 10 && digits.length <= 11) {
    return `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`;
  }
  return fallback;
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
