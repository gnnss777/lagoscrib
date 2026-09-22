import { describe, expect, it } from "vitest";
import { PRICE_PER_M2_DECIMALS } from "@/lib/constants";
import { pricePerM2, totalAllIn } from "@/lib/pricing";

// TDD S001 (RED→GREEN): lógica pura de precificação antes de tocar data.ts.
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
describe("pricing", () => {
  it("test_pricing_precom2_valores_tipicos_retorna_1decimal", () => {
    // arrange
    const total = 322000;
    const area = 90;

    // act
    const result = pricePerM2(total, area);

    // assert: 322000/90 = 3577.77… → 3577.8
    expect(result).toBe(3577.8);
    expect(PRICE_PER_M2_DECIMALS).toBe(1);
  });

  it("test_pricing_precom2_area_zero_retorna_zero", () => {
    expect(pricePerM2(322000, 0)).toBe(0);
  });

  it("test_pricing_totalallin_aluguel_soma_componentes", () => {
    const result = totalAllIn({
      transaction: "aluguel",
      rent: 2500,
      condo: 580,
      iptu: 140,
    });
    expect(result).toBe(3220);
  });

  it("test_pricing_totalallin_condesconhecido_ignora_condominio", () => {
    // condoUnknown = nunca somar condominio ficticio (ADR-001 §4)
    const result = totalAllIn({
      transaction: "aluguel",
      rent: 2350,
      condo: 999, // valor obsoleto/ficticio deve ser ignorado
      iptu: 0,
      condoUnknown: true,
    });
    expect(result).toBe(2350);
  });

  it("test_pricing_totalallin_venda_retorna_salepreco", () => {
    const result = totalAllIn({
      transaction: "venda",
      rent: 0,
      condo: 580,
      iptu: 140,
      salePrice: 450000,
    });
    expect(result).toBe(450000);
  });
});
