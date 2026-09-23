import { describe, expect, it } from "vitest";
import { apartments, saleApartments } from "@/lib/data";
import { totalAllIn } from "@/lib/pricing";

// Expansão da base (5 fontes, 22/09/2026): invariantes de toda a base,
// originais + novos. Regras: sem contato, link verbatim, total consistente,
// fotos locais, verifiedAt, ids únicos, combos cobertos.
describe("expansao base", () => {
  const all = [...apartments, ...saleApartments];

  it("test_expansao_sem_telefone_email", () => {
    for (const a of all) {
      expect(a.phone).toBe("");
      expect(a.email).toBe("");
    }
  });

  it("test_expansao_links_verbatim_por_fonte", () => {
    const domains = [
      "zapimoveis.com.br/imovel/",
      "vivareal.com.br/imovel/",
      "olx.com.br",
      "apolar.com.br/",
      "imobiliariasillos.com.br/imovel/",
      "mafiimoveis.com.br/imovel/",
      "cadenaimoveis.com.br/imovel/",
      "jbaimoveis.com.br/imovel/",
      "casaaolado.imb.br/imovel/",
      "hapenimoveis.com.br/imovel/",
      "imobiliariaconfianza.com.br/imovel/",
    ];
    for (const a of all) {
      expect(domains.some((d) => a.link.includes(d))).toBe(true);
    }
  });

  it("test_expansao_totais_consistentes", () => {
    for (const a of all) {
      expect(totalAllIn(a)).toBe(a.total);
      if (a.transaction === "venda") {
        expect(a.salePrice).toBeGreaterThan(0);
        expect(a.total).toBe(a.salePrice);
        expect(a.rent).toBe(0);
      } else {
        expect(a.total).toBe(a.rent + a.condo + a.iptu);
      }
    }
  });

  it("test_expansao_fotos_locais", () => {
    for (const a of all) {
      expect(a.image).toMatch(/^\/imoveis\/.+\.webp$/);
      expect(a.photos?.length).toBeGreaterThanOrEqual(1);
      expect(a.photos?.[0]?.src).toBe(a.image);
    }
  });

  it("test_expansao_verifiedAt_presente", () => {
    for (const a of all) {
      expect(a.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("test_expansao_ids_unicos", () => {
    const ids = all.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("test_expansao_combos_cobertos", () => {
    const bands = [1, 2, 3, 4];
    for (const tab of ["alugar", "comprar"] as const) {
      const pool =
        tab === "comprar"
          ? all.filter((a) => a.transaction === "venda")
          : all.filter((a) => a.transaction !== "venda");
      for (const b of bands) {
        const n =
          b === 4
            ? pool.filter((a) => a.bedrooms >= 4).length
            : pool.filter((a) => a.bedrooms === b).length;
        expect(n).toBeGreaterThan(0);
      }
    }
  });
});
