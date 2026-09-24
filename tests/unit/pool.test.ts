import { describe, expect, it, afterEach } from "vitest";
import { getAllApartments, USER_ADDED_KEY } from "@/lib/pool";
import { apartments, saleApartments } from "@/lib/data";

// Pool único de imóveis (fecha B2): estáticos + adicionados pelo usuário.
// Dashboard e Kanban consomem a mesma função — sem duplicação.
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
afterEach(() => {
  const g = globalThis as Record<string, unknown>;
  delete g["localStorage"];
});

function stubLocalStorage(data: Record<string, string>) {
  const g = globalThis as Record<string, unknown>;
  g["localStorage"] = {
    getItem: (k: string) => data[k] ?? null,
  };
}

describe("pool único", () => {
  it("test_kanban_pool_unico_static_plus_user_added", () => {
    // arrange: 1 imóvel do usuário no localStorage
    stubLocalStorage({
      [USER_ADDED_KEY]: JSON.stringify([
        {
          id: "user-1",
          title: "Apê do usuário",
          neighborhood: "Batel",
          transaction: "aluguel",
        },
      ]),
    });

    // act
    const all = getAllApartments();

    // assert: estáticos + o do usuário, sem duplicar
    expect(all.length).toBe(
      apartments.length + saleApartments.length + 1,
    );
    expect(all.some((a) => a.id === "user-1")).toBe(true);
  });

  it("test_kanban_pool_dedupe_apartment_id", () => {
    stubLocalStorage({
      [USER_ADDED_KEY]: JSON.stringify([
        { id: "user-1", title: "Apê do usuário" },
        { id: "user-1", title: "Apê do usuário" },
      ]),
    });

    const all = getAllApartments();

    expect(all.filter((apartment) => apartment.id === "user-1")).toHaveLength(1);
  });

  it("test_kanban_pool_sem_storage_so_estaticos", () => {
    // arrange: sem localStorage (SSR/node) — act/assert: só estáticos
    const all = getAllApartments();
    expect(all.length).toBe(apartments.length + saleApartments.length);
  });

  it("test_kanban_pool_json_quebrado_nao_quebra", () => {
    // arrange: lixo no storage — act/assert: cai para os estáticos
    stubLocalStorage({ [USER_ADDED_KEY]: "lixo{{{" });
    const all = getAllApartments();
    expect(all.length).toBe(apartments.length + saleApartments.length);
  });

  it("test_kanban_pool_user_added_ganha_transaction_default", () => {
    // arrange: imóvel do usuário sem transaction (aditivo S001)
    stubLocalStorage({
      [USER_ADDED_KEY]: JSON.stringify([{ id: "user-2", title: "X" }]),
    });

    // act/assert: default "aluguel"
    const all = getAllApartments();
    expect(
      all.find((a) => a.id === "user-2")?.transaction,
    ).toBe("aluguel");
  });
});
