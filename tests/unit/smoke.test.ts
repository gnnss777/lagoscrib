import { describe, expect, it } from "vitest";
import { apartments } from "@/lib/data";

// Smoke da infra vitest: prova o runner contra dados reais do app.
// Trava a contagem da base ativa (leva 12, S011). A contagem caiu de 152 para
// 149 por causa do dedupe entre portais (data/coleta/dedupe.py): três anúncios
// eram o mesmo imóvel em VivaReal/Zap/Chaves na Mão, e a procedência dos
// absorvidos ficou em `otherLinks` do vencedor em vez de sumir.
// Convenção do estúdio:
// test_[sistema]_[cenário]_[resultado_esperado] (arrange/act/assert).
describe("dados", () => {
  it("test_dados_smoke_149imoveis_com_campos_obrigatorios", () => {
    // arrange: dados estáticos versionados em lib/data.ts
    const items = apartments;

    // act: nada a executar — leitura direta (determinístico, sem I/O)

    // assert
    expect(items).toHaveLength(149);
    for (const a of items) {
      expect(a.id, "id").toBeTruthy();
      expect(a.title, "title").toBeTruthy();
      expect(a.neighborhood, "neighborhood").toBeTruthy();
      expect(a.total, "total >= 0").toBeGreaterThanOrEqual(0);
      expect(a.link, "link original").toMatch(/^https?:\/\//);
    }
  });

  // O dedupe absorveu três anúncios e guardou o link de cada um no vencedor. Se
  // alguém mexer na fusão e perder a procedência, este teste quebra: nenhum
  // link pode sumir da base.
  it("test_dedupe_nenhum_link_de_procedencia_perdido", () => {
    const comOtherLinks = apartments.filter((a) => (a.otherLinks ?? []).length > 0);

    expect(comOtherLinks).toHaveLength(3);

    const todos = new Set<string>();
    for (const a of apartments) {
      todos.add(a.link);
      for (const l of a.otherLinks ?? []) todos.add(l);
    }

    // 149 imóveis + 3 absorvidos = 152 anúncios originais.
    expect(todos.size).toBe(152);
    for (const l of todos) expect(l, `link ${l.slice(0, 50)}`).toMatch(/^https?:\/\//);
  });
});
