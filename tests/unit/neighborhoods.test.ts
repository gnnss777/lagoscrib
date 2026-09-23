import { describe, expect, it } from "vitest";
import {
  getRegional,
  MARKET_ALIAS_REGIONAL,
  REGIONAL_GROUPS,
} from "@/lib/neighborhoods";
import { apartments, saleApartments } from "@/lib/data";

// Expansão da base (5 fontes, 22/09/2026): taxonomia oficial das 10 Regionais.
describe("regionais", () => {
  it("test_regional_10_grupos_75_bairros_unicos", () => {
    expect(REGIONAL_GROUPS).toHaveLength(10);
    const all = REGIONAL_GROUPS.flatMap((g) => g.neighborhoods);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(75);
  });

  it("test_regional_ecoville_alias_mercado", () => {
    // Ecoville não é bairro oficial (Ippuc) — resolve p/ Santa Felicidade.
    expect(MARKET_ALIAS_REGIONAL["Ecoville"]).toBe("Santa Felicidade");
    expect(getRegional("Ecoville")).toBe("Santa Felicidade");
  });

  it("test_regional_todos_bairros_do_app_resolvem", () => {
    for (const a of [...apartments, ...saleApartments]) {
      expect(getRegional(a.neighborhood)).not.toBeNull();
    }
  });

  it("test_regional_campo_comprido_sem_dupla_contagem", () => {
    const hits = REGIONAL_GROUPS.filter((g) =>
      g.neighborhoods.includes("Campo Comprido")
    );
    expect(hits.map((g) => g.regional)).toEqual(["Santa Felicidade"]);
  });
});
