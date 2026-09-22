import { describe, expect, it } from "vitest";
import {
  filterByTransaction,
  isSale,
  priceSuffix,
} from "@/lib/transaction";
import type { Apartment } from "@/lib/data";

// TDD S006 (RED→GREEN): regra de transação antes da UI.
// Ausente = aluguel (aditivo S001 — nada quebra).
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
describe("transaction", () => {
  const apt = (over: Partial<Apartment>): Apartment =>
    ({
      id: "x",
      title: "X",
      total: 3220,
      ...over,
    }) as Apartment;

  it("test_transacao_sem_campo_e_aluguel", () => {
    expect(isSale(apt({}))).toBe(false);
  });

  it("test_transacao_venda_detectada", () => {
    expect(isSale(apt({ transaction: "venda" }))).toBe(true);
  });

  it("test_transacao_filtro_comprar_so_vendas", () => {
    const list = [
      apt({ id: "a" }),
      apt({ id: "v", transaction: "venda", salePrice: 1 }),
    ];
    expect(filterByTransaction(list, "comprar").map((a) => a.id)).toEqual(["v"]);
  });

  it("test_transacao_filtro_alugar_exclui_vendas", () => {
    const list = [
      apt({ id: "a" }),
      apt({ id: "v", transaction: "venda", salePrice: 1 }),
    ];
    expect(filterByTransaction(list, "alugar").map((a) => a.id)).toEqual(["a"]);
  });

  it("test_transacao_sufixo_venda_sem_mes", () => {
    expect(priceSuffix(apt({ transaction: "venda" }))).toBe("");
    expect(priceSuffix(apt({}))).toBe("/mês");
  });
});
