import { describe, expect, it } from "vitest";
import { apartments, saleApartments } from "@/lib/data";
import { TETO_TOTAL_ALUGUEL } from "@/lib/constants";
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
    // Portais ativos na leva 4. Apolar entra com a URL do anúncio
    // (/alugar/apartamento/...), não mais com ?ref= da home.
    const domains = [
      "zapimoveis.com.br/imovel/",
      "vivareal.com.br/imovel/",
      "olx.com.br",
      "apolar.com.br/",
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
    // Leva 4 (27/09/2026): coleta dirigida para 2-3 quartos (--quartos=2,3) com
    // teto de R$ 3.000 (--preco-max=3000). As faixas de 1 e 4+ ficam vazias por
    // decisão — o filtro mostra "1 quarto · 0". A base de venda está vazia.
    const pool = all.filter((a) => a.transaction !== "venda");
    for (const b of [2, 3]) {
      const n = pool.filter((a) => a.bedrooms === b).length;
      expect(n, `faixa ${b} quartos`).toBeGreaterThan(0);
    }
  });

  it("test_expansao_dentro_do_escopo_da_leva", () => {
    // Trava o critério da coleta: 2-3 quartos e R$ 3.500 com TODAS as taxas.
    // O teto é no all-in (aluguel + condomínio + IPTU), não no aluguel: o filtro
    // de busca dos portais é por aluguel (--preco-max), então travar só o
    // aluguel deixaria passar imóvel de R$ 2.500 com R$ 1.300 de condomínio.
    // Sem isso uma leva futura muda o produto em silêncio.
    // Ver docs/stories/S010-coleta-teto-allin-3500.md.
    for (const a of all) {
      expect([2, 3], `${a.id} quartos`).toContain(a.bedrooms);
      expect(a.total, `${a.id} all-in`).toBeLessThanOrEqual(TETO_TOTAL_ALUGUEL);
    }
  });
});
