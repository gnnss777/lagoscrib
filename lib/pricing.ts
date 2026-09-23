import { PRICE_PER_M2_DECIMALS } from "./constants";

// Lógica pura de precificação (S001). Sem I/O, sem DOM — testável em vitest.
export interface PricedInput {
  transaction?: "aluguel" | "venda";
  rent: number;
  condo: number;
  iptu: number;
  condoUnknown?: boolean;
  salePrice?: number;
}

// Preço por m² com casas decimais de PRICE_PER_M2_DECIMALS.
// Área zero/ausente retorna 0 (nunca NaN/Infinity na UI).
export function pricePerM2(total: number, area: number): number {
  if (!area || area <= 0) return 0;
  const factor = 10 ** PRICE_PER_M2_DECIMALS;
  return Math.round((total / area) * factor) / factor;
}

// Custo total efetivo:
// - aluguel: aluguel + condomínio + IPTU (condoUnknown ignora condo — ADR-001 §4);
// - venda: salePrice (componentes mensais não entram no total de aquisição).
export function totalAllIn(input: PricedInput): number {
  if (input.transaction === "venda") return input.salePrice ?? 0;
  const condo = input.condoUnknown ? 0 : input.condo;
  return input.rent + condo + input.iptu;
}
