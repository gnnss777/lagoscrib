import { describe, expect, it } from "vitest";
import { apartments, saleApartments } from "@/lib/data";
import { totalAllIn, pricePerM2 } from "@/lib/pricing";
import { ehTelefoneValido } from "@/lib/phone-gate";

// Leva 4 (27/09/2026): base zerada e repovoada só com aluguel.
// As invariantes valem para a base inteira — sem lista de ids fixos, que
// quebrava a cada leva. A contagem fica travada em smoke.test.ts.
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
describe("dados", () => {
  it("test_dados_aluguel_sem_entradas_venda", () => {
    // assert: nenhuma entrada de venda vaza para o dashboard de aluguel
    expect(apartments.every((a) => a.transaction !== "venda")).toBe(true);
  });

  it("test_dados_venda_vazio_na_leva_de_aluguel", () => {
    expect(saleApartments).toHaveLength(0);
  });

  it("test_dados_aluguel_campos_validados", () => {
    for (const a of apartments) {
      expect(a.id, "id").toBeTruthy();
      expect(a.verifiedAt, a.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.link, a.id).toMatch(/^https:\/\//);
      expect(a.image, a.id).toMatch(/^\/imoveis\/.*\.webp$/);
      expect(a.photos?.length, `${a.id} fotos`).toBeGreaterThanOrEqual(8);
      if (a.phone) expect(ehTelefoneValido(a.phone), `${a.id} phone=${a.phone}`).toBe(true);
      expect(a.email, a.id).toBe("");
    }
  });

  it("test_dados_aluguel_totais_consistentes_com_pricing", () => {
    // assert: total armazenado == totalAllIn e preço/m² computável.
    // Cobre ADR-001 §4: condomínio desconhecido é condo 0 + condoUnknown, então
    // o total continua fechando sem valor inventado.
    for (const a of apartments) {
      expect(totalAllIn(a), a.id).toBe(a.total);
      expect(pricePerM2(a.total, a.area), a.id).toBeGreaterThan(0);
    }
  });
});
