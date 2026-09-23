import { describe, expect, it } from "vitest";
import {
  buildCompareFlags,
  effectiveTotal,
  sortCompareByTotalEffective,
  toggleCompareSelection,
} from "@/lib/compare";
import type { Apartment } from "@/lib/data";

// TDD S005 (RED→GREEN): núcleo puro da comparação antes da UI.
// Ordenação default por custo total efetivo (ADR-002 decisão 4).
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
describe("compare", () => {
  const apt = (over: Partial<Apartment>): Apartment =>
    ({
      id: "x",
      title: "X",
      neighborhood: "Centro",
      address: "Rua X",
      area: 100,
      bedrooms: 3,
      bathrooms: 2,
      parking: 1,
      rent: 2000,
      condo: 500,
      iptu: 100,
      total: 2600,
      phone: "",
      email: "",
      link: "https://exemplo.com/a",
      image: "/imoveis/x.webp",
      features: [],
      description: "X",
      ...over,
    }) as Apartment;

  it("test_compare_totalefetivo_aluguel_usa_total", () => {
    expect(effectiveTotal(apt({ total: 3220 }))).toBe(3220);
  });

  it("test_compare_totalfetivo_venda_usa_salepreco", () => {
    expect(
      effectiveTotal(apt({ transaction: "venda", salePrice: 354010, total: 354010 }))
    ).toBe(354010);
  });

  it("test_compare_ordem_misto_venda_e_aluguel_crescente", () => {
    const sorted = sortCompareByTotalEffective([
      apt({ id: "caro", total: 4412 }),
      apt({ id: "venda", transaction: "venda", salePrice: 354010, total: 354010 }),
      apt({ id: "barato", total: 2350 }),
    ]);
    expect(sorted.map((a) => a.id)).toEqual(["barato", "caro", "venda"]);
  });

  it("test_compare_toggle_adiciona_ate_4", () => {
    let sel: string[] = [];
    for (const id of ["a", "b", "c", "d"]) {
      const r = toggleCompareSelection(sel, id);
      sel = r.selected;
      expect(r.blocked).toBe(false);
    }
    expect(sel).toHaveLength(4);
  });

  it("test_compare_quinto_bloqueado_com_aviso", () => {
    const r = toggleCompareSelection(["a", "b", "c", "d"], "e");
    expect(r.blocked).toBe(true);
    expect(r.selected).toEqual(["a", "b", "c", "d"]);
  });

  it("test_compare_toggle_remove_existentes", () => {
    const r = toggleCompareSelection(["a", "b", "c"], "b");
    expect(r.blocked).toBe(false);
    expect(r.selected).toEqual(["a", "c"]);
  });

  it("test_compare_flags_sem_garagem_e_condaconfirmar", () => {
    const flags = buildCompareFlags(
      apt({ parking: 0, condoUnknown: true, features: ["SEM ELEVADOR (3º andar)"] })
    );
    expect(flags).toContain("sem garagem");
    expect(flags).toContain("cond a confirmar");
    expect(flags).toContain("sem elevador");
  });

  it("test_compare_flags_completo_retorna_vazio", () => {
    expect(buildCompareFlags(apt({}))).toEqual([]);
  });
});
