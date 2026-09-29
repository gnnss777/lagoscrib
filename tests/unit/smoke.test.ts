import { describe, expect, it } from "vitest";
import { apartments } from "@/lib/data";

// Smoke da infra vitest: prova o runner contra dados reais do app.
// Trava a contagem da base ativa (leva 12, S011: 152 imóveis de aluguel,
// 2-3 quartos, all-in até R$ 3.600). Convenção do estúdio:
// test_[sistema]_[cenário]_[resultado_esperado] (arrange/act/assert).
describe("dados", () => {
  it("test_dados_smoke_152imoveis_com_campos_obrigatorios", () => {
    // arrange: dados estáticos versionados em lib/data.ts
    const items = apartments;

    // act: nada a executar — leitura direta (determinístico, sem I/O)

    // assert
    expect(items).toHaveLength(152);
    for (const a of items) {
      expect(a.id, "id").toBeTruthy();
      expect(a.title, "title").toBeTruthy();
      expect(a.neighborhood, "neighborhood").toBeTruthy();
      expect(a.total, "total >= 0").toBeGreaterThanOrEqual(0);
      expect(a.link, "link original").toMatch(/^https?:\/\//);
    }
  });
});
