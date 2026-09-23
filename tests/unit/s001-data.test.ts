import { describe, expect, it } from "vitest";
import { apartments, saleApartments } from "@/lib/data";
import { totalAllIn, pricePerM2 } from "@/lib/pricing";

// S001: contrato dos dados de venda + trava anti-regressão do aluguel.
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
describe("dados venda", () => {
  it("test_dados_aluguel_sem_entradas_venda", () => {
    // arrange/act: export legado intacto
    // assert: nenhuma entrada de venda vaza para o dashboard de aluguel
    expect(apartments).toHaveLength(7);
    expect(
      apartments.every((a) => a.transaction !== "venda")
    ).toBe(true);
  });

  it("test_dados_venda_5imoveis_com_campos_validados", () => {
    // assert: 5 vendas (Fazendinha descartada: só 5 fotos < 8 mínimas)
    expect(saleApartments).toHaveLength(5);
    for (const a of saleApartments) {
      expect(a.transaction).toBe("venda");
      expect(a.verifiedAt).toBe("2026-09-22");
      expect(a.salePrice).toBeGreaterThan(0);
      expect(a.total).toBe(a.salePrice);
      expect(a.link).toMatch(/^https:\/\/www\.zapimoveis\.com\.br\/imovel\//);
      expect(a.image).toMatch(/^\/imoveis\/.*\.webp$/);
      expect(a.photos?.length).toBeGreaterThanOrEqual(1);
      expect(a.phone).toBe("");
      expect(a.email).toBe("");
    }
  });

  it("test_dados_venda_totais_consistentes_com_pricing", () => {
    // assert: total armazenado == totalAllIn (venda) e preço/m² computável
    for (const a of saleApartments) {
      expect(totalAllIn(a)).toBe(a.total);
      expect(pricePerM2(a.total, a.area)).toBeGreaterThan(0);
    }
  });
});
