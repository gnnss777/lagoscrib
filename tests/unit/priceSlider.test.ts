import { describe, expect, it } from "vitest";
import {
  clampRange,
  priceToSliderPos,
  sliderPosToPrice,
  getSliderConfig,
} from "@/lib/priceSlider";
import {
  RENT_PRICE_BOUNDS,
  SALE_PRICE_BOUNDS,
} from "@/lib/constants";

// Slider de preço (leva kanban-tela-inteira-ui, AC-U4/U5).
// Lógica pura: posição ↔ preço; componente só chama e renderiza.
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
describe("price slider", () => {
  it("test_slider_bounds_declared_por_aba", () => {
    // arrange/act
    const rent = getSliderConfig("alugar");
    const sale = getSliderConfig("comprar");

    // assert: bounds batem com os declarados (fonte única: constants)
    expect(rent.min).toBe(RENT_PRICE_BOUNDS.min);
    expect(rent.max).toBe(RENT_PRICE_BOUNDS.max);
    expect(rent.scale).toBe("linear");
    expect(sale.min).toBe(SALE_PRICE_BOUNDS.min);
    expect(sale.max).toBe(SALE_PRICE_BOUNDS.max);
    expect(sale.scale).toBe("log");
    expect(rent.steps).toBeGreaterThan(0);
    expect(sale.steps).toBeGreaterThan(0);
  });

  it("test_slider_roundtrip_linear_posicao_igual", () => {
    // arrange
    const cfg = getSliderConfig("alugar");

    // act/assert: pos→preço→pos com tolerância de 1 posição (AC-U5)
    for (let pos = 0; pos <= cfg.steps; pos += 17) {
      const price = sliderPosToPrice(pos, "alugar");
      const back = priceToSliderPos(price, "alugar");
      expect(
        Math.abs(back - pos),
        `pos ${pos} → R$${price} → pos ${back}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("test_slider_roundtrip_log_venda_posicao_igual", () => {
    // arrange: amostras reais de venda
    const samples = [100_000, 500_000, 1_000_000, 5_000_000, 10_000_000, 30_000_000];

    // act/assert: preço→pos→preço com erro relativo ≤ 5% (log)
    for (const price of samples) {
      const pos = priceToSliderPos(price, "comprar");
      const back = sliderPosToPrice(pos, "comprar");
      const rel = Math.abs(back - price) / price;
      expect(rel, `R$${price} → pos ${pos} → R$${back}`).toBeLessThanOrEqual(0.05);
    }
  });

  it("test_slider_clamp_min_maior_que_max_mantem_ordem", () => {
    // arrange/act: usuário arrasta mín além do máx
    const clamped = clampRange(20_000, 500);

    // assert: ordem garantida (min ≤ max SEMPRE)
    expect(clamped.min!).toBeLessThanOrEqual(clamped.max!);
    expect(clamped).toEqual({ min: 500, max: 20_000 });
  });

  it("test_slider_null_mapeia_para_extremos", () => {
    // arrange/act: null = "tanto faz" → extremos da faixa
    const rent = getSliderConfig("alugar");

    // assert
    expect(priceToSliderPos(null, "alugar")).toBe(0);
    expect(sliderPosToPrice(0, "alugar")).toBe(rent.min);
    expect(sliderPosToPrice(rent.steps, "alugar")).toBe(rent.max);
  });

  it("test_slider_posicao_fora_da_faixa_corta_nos_limites", () => {
    // arrange/act/assert: posições inválidas saturam
    const rent = getSliderConfig("alugar");
    expect(sliderPosToPrice(-5, "alugar")).toBe(rent.min);
    expect(sliderPosToPrice(rent.steps + 99, "alugar")).toBe(rent.max);
  });
});
