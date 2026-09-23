// Slider de preço — lógica pura (leva kanban-tela-inteira-ui, AC-U4/U5).
// REGRA DO ESTÚDIO: UI apenas exibe; posição ↔ preço mora aqui (testável em node).
// Aluguel = linear; venda = log (0–35M linear é inutilizável — decisão Gabriel 22/09).
// Posição 0 SEMPRE = min da faixa (R$0 "tanto faz"); no log, pos ≥1 parte do piso.
import {
  PRICE_SLIDER_RENT_STEPS,
  PRICE_SLIDER_SALE_FLOOR,
  PRICE_SLIDER_SALE_STEPS,
  RENT_PRICE_BOUNDS,
  SALE_PRICE_BOUNDS,
} from "@/lib/constants";
import type { TransactionTab } from "@/lib/transaction";

export type SliderScale = "linear" | "log";

export interface SliderConfig {
  min: number;
  max: number;
  steps: number;
  scale: SliderScale;
  /** Piso da escala log (venda). Posição 0 = min; pos ≥1 ∈ [floor, max]. */
  floor: number;
}

export function getSliderConfig(tab: TransactionTab): SliderConfig {
  if (tab === "comprar") {
    return {
      min: SALE_PRICE_BOUNDS.min,
      max: SALE_PRICE_BOUNDS.max,
      steps: PRICE_SLIDER_SALE_STEPS,
      scale: "log",
      floor: PRICE_SLIDER_SALE_FLOOR,
    };
  }
  return {
    min: RENT_PRICE_BOUNDS.min,
    max: RENT_PRICE_BOUNDS.max,
    steps: PRICE_SLIDER_RENT_STEPS,
    scale: "linear",
    floor: RENT_PRICE_BOUNDS.min,
  };
}

function clampPos(pos: number, steps: number): number {
  if (Number.isNaN(pos)) return 0;
  return Math.min(steps, Math.max(0, Math.round(pos)));
}

/** Posição (0..steps) → preço em R$. Saturação nos limites. */
export function sliderPosToPrice(pos: number, tab: TransactionTab): number {
  const cfg = getSliderConfig(tab);
  const p = clampPos(pos, cfg.steps);
  if (p === 0) return cfg.min;
  if (cfg.scale === "linear") {
    const span = cfg.max - cfg.min;
    // Passo em R$50 exato no aluguel (20000/400) — round evita 19999.99.
    return Math.round(cfg.min + (p / cfg.steps) * span);
  }
  // Log: pos 1..steps ↔ floor..max geometricamente.
  const logFloor = Math.log(cfg.floor);
  const logMax = Math.log(cfg.max);
  const t = (p - 1) / (cfg.steps - 1);
  return Math.round(Math.exp(logFloor + t * (logMax - logFloor)));
}

/** Preço (ou null = "tanto faz") → posição (0..steps). */
export function priceToSliderPos(
  price: number | null | undefined,
  tab: TransactionTab,
): number {
  const cfg = getSliderConfig(tab);
  if (price == null || price <= cfg.min) return 0;
  if (price >= cfg.max) return cfg.steps;
  if (cfg.scale === "linear") {
    const span = cfg.max - cfg.min;
    return clampPos(((price - cfg.min) / span) * cfg.steps, cfg.steps);
  }
  if (price <= cfg.floor) return 1;
  const logFloor = Math.log(cfg.floor);
  const logMax = Math.log(cfg.max);
  const t =
    (Math.log(price) - logFloor) / (logMax - logFloor);
  return clampPos(1 + t * (cfg.steps - 1), cfg.steps);
}

/** Garante min ≤ max após arrastar os thumbs (ordem SEMPRE). */
export function clampRange(
  min: number | null,
  max: number | null,
): { min: number | null; max: number | null } {
  if (min != null && max != null && min > max) {
    return { min: max, max: min };
  }
  return { min, max };
}
