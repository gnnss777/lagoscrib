"use client";

import { formatBRL } from "@/lib/antiDores";
import {
  PRICE_SLIDER_MAX_LABEL,
  PRICE_SLIDER_MIN_LABEL,
} from "@/lib/constants";
import {
  clampRange,
  getSliderConfig,
  priceToSliderPos,
  sliderPosToPrice,
} from "@/lib/priceSlider";
import type { TransactionTab } from "@/lib/transaction";

interface PriceRangeSliderProps {
  tab: TransactionTab;
  priceMin: number | null;
  priceMax: number | null;
  sectionLabel: string;
  onChange: (min: number | null, max: number | null) => void;
}

// Slider duplo de preço (leva kanban-tela-inteira-ui, AC-U4/U6).
// Presentacional: posição ↔ preço mora em lib/priceSlider.ts; aqui só
// chama e renderiza. Thumbs nativos (teclado + aria-valuetext AAA).
export default function PriceRangeSlider({
  tab,
  priceMin,
  priceMax,
  sectionLabel,
  onChange,
}: PriceRangeSliderProps) {
  const cfg = getSliderConfig(tab);
  const posMin = priceToSliderPos(priceMin, tab);
  const posMax =
    priceMax == null ? cfg.steps : priceToSliderPos(priceMax, tab);

  const pct = (p: number) => (p / cfg.steps) * 100;

  const handleMin = (pos: number) => {
    const price = sliderPosToPrice(pos, tab);
    const next = clampRange(pos === 0 ? null : price, priceMax);
    onChange(next.min, next.max);
  };

  const handleMax = (pos: number) => {
    const price = sliderPosToPrice(pos, tab);
    const next = clampRange(priceMin, pos >= cfg.steps ? null : price);
    onChange(next.min, next.max);
  };

  // Thumb de cima: o da metade oposta (evita "thumb preso" quando colados).
  const minOnTop = posMin > cfg.steps / 2;

  const valueText = (v: number | null, fallback: string) =>
    v == null ? fallback : formatBRL(v);

  return (
    <div>
      <span id="price-slider-label" className="block text-xs font-medium text-ink-soft mb-1">
        {sectionLabel}
      </span>
      <div className="flex items-center gap-3 mb-2">
        <span
          aria-live="polite"
          className="text-sm font-semibold text-ink bg-paper border border-line rounded-full px-3 py-1.5 min-w-24 text-center"
        >
          {valueText(priceMin, "Sem mín")}
        </span>
        <span aria-hidden="true" className="text-muted text-sm">
          –
        </span>
        <span
          aria-live="polite"
          className="text-sm font-semibold text-ink bg-paper border border-line rounded-full px-3 py-1.5 min-w-24 text-center"
        >
          {valueText(priceMax, "Sem máx")}
        </span>
      </div>
      <div
        role="group"
        aria-labelledby="price-slider-label"
        className="relative h-11 flex items-center"
      >
        {/* Trilho + trecho ativo entre os thumbs */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 h-2 rounded-full bg-line"
        />
        <div
          aria-hidden="true"
          className="absolute h-2 rounded-full bg-taxi"
          style={{ left: `${pct(posMin)}%`, width: `${pct(posMax) - pct(posMin)}%` }}
        />
        <input
          type="range"
          aria-label={PRICE_SLIDER_MIN_LABEL}
          aria-valuetext={valueText(priceMin, "Sem mínimo")}
          min={0}
          max={cfg.steps}
          step={1}
          value={posMin}
          onChange={(e) => handleMin(Number(e.target.value))}
          className="price-slider-input"
          style={{ zIndex: minOnTop ? 4 : 3 }}
        />
        <input
          type="range"
          aria-label={PRICE_SLIDER_MAX_LABEL}
          aria-valuetext={valueText(priceMax, "Sem máximo")}
          min={0}
          max={cfg.steps}
          step={1}
          value={posMax}
          onChange={(e) => handleMax(Number(e.target.value))}
          className="price-slider-input"
          style={{ zIndex: minOnTop ? 3 : 4 }}
        />
      </div>
    </div>
  );
}
