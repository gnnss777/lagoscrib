import { describe, expect, it } from "vitest";
import { apartments } from "@/lib/data";
import { TETO_TOTAL_ALUGUEL } from "@/lib/constants";

// Trava o escopo do produto na base: 2–3 quartos e R$ 3.500 com TODAS as taxas
// (aluguel + condomínio + IPTU). O filtro de busca dos portais é por aluguel, então
// sem esta trava a base aceita imóvel de R$ 2.500 com R$ 1.300 de condomínio.
describe("dados", () => {
  it("test_dados_teto_allin_3500_nunca_estourado", () => {
    for (const a of apartments) {
      expect(
        a.total,
        `${a.id}: all-in ${a.total} (aluguel ${a.rent} + condo ${a.condo} + iptu ${a.iptu}) acima de ${TETO_TOTAL_ALUGUEL}`,
      ).toBeLessThanOrEqual(TETO_TOTAL_ALUGUEL);
    }
  });

  it("test_dados_total_fecha_com_aluguel_condo_iptu", () => {
    for (const a of apartments) {
      expect(a.total, `${a.id}: total nao fecha`).toBe(a.rent + a.condo + a.iptu);
    }
  });
});
