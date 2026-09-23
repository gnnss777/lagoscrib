import { describe, expect, it } from "vitest";
import { apartments, saleApartments } from "@/lib/data";
import { totalAllIn, pricePerM2 } from "@/lib/pricing";

// Base expandida 22/09/2026 (5 fontes): 57 aluguel + 52 venda.
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
describe("dados venda", () => {
  it("test_dados_aluguel_sem_entradas_venda", () => {
    // assert: nenhuma entrada de venda vaza para o dashboard de aluguel
    expect(apartments).toHaveLength(57);
    expect(apartments.every((a) => a.transaction !== "venda")).toBe(true);
  });

  it("test_dados_venda_52imoveis_com_campos_validados", () => {
    expect(saleApartments).toHaveLength(52);
    const originais = [
      "zap-bacacheri-parana-107",
      "zap-tingui-brasilio-71",
      "zap-aguaverde-iguacu-140",
      "zap-capaoraso-churchill-78",
      "zap-ecoville-rosa-87",
    ];
    for (const a of saleApartments) {
      expect(a.transaction).toBe("venda");
      expect(a.verifiedAt).toBe("2026-09-22");
      expect(a.salePrice).toBeGreaterThan(0);
      expect(a.total).toBe(a.salePrice);
      expect(a.link).toMatch(/^https:\/\//);
      expect(a.image).toMatch(/^\/imoveis\/.*\.webp$/);
      expect(a.photos?.length).toBeGreaterThanOrEqual(1);
      expect(a.phone).toBe("");
      expect(a.email).toBe("");
    }
    // Regressão: os 5 originais continuam presentes.
    for (const id of originais) {
      expect(saleApartments.some((a) => a.id === id)).toBe(true);
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
