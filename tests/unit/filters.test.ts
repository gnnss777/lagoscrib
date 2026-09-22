import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  applyFilters,
  applySort,
  countActiveFilters,
  type FilterState,
} from "@/lib/filters";
import type { Apartment } from "@/lib/data";

// TDD S008 (RED→GREEN): núcleo puro de filtros antes da UI.
// Regra dura do plano: dado ausente (undefined) nunca exclui (aditivo).
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
describe("filters", () => {
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

  const base = (over: Partial<FilterState> = {}): FilterState => ({
    ...DEFAULT_FILTERS,
    ...over,
  });

  const ids = (list: Apartment[]): string[] => list.map((a) => a.id);

  it("test_filtros_busca_texto_caseinsensitive_filtra", () => {
    const list = [
      apt({ id: "a", title: "Apartamento com 3 Quartos - Água Verde" }),
      apt({ id: "b", title: "Cobertura no Batel" }),
    ];
    expect(ids(applyFilters(list, base({ search: "AGUA verde" })))).toEqual([
      "a",
    ]);
  });

  it("test_filtros_quartos_min3_exclui_2quartos", () => {
    const list = [
      apt({ id: "q2", bedrooms: 2 }),
      apt({ id: "q3", bedrooms: 3 }),
      apt({ id: "q4", bedrooms: 4 }),
    ];
    expect(ids(applyFilters(list, base({ bedroomsMin: 3 })))).toEqual([
      "q3",
      "q4",
    ]);
  });

  it("test_filtros_banheiros_min2_inclui_suites", () => {
    const list = [
      apt({ id: "b1", bathrooms: 1 }),
      apt({ id: "b2", bathrooms: 2 }),
      apt({ id: "b5", bathrooms: 5 }),
    ];
    expect(ids(applyFilters(list, base({ bathroomsMin: 2 })))).toEqual([
      "b2",
      "b5",
    ]);
  });

  it("test_filtros_vagas_min2_apenas_duasvagas", () => {
    const list = [apt({ id: "v1", parking: 1 }), apt({ id: "v2", parking: 2 })];
    expect(ids(applyFilters(list, base({ parkingMin: 2 })))).toEqual(["v2"]);
  });

  it("test_filtros_faixapreco_min_max_inclusivo", () => {
    const list = [
      apt({ id: "barato", total: 2350 }),
      apt({ id: "meio", total: 3220 }),
      apt({ id: "caro", total: 4412 }),
    ];
    // Limites inclusivos: teto exato entra.
    expect(
      ids(applyFilters(list, base({ priceMin: 3000, priceMax: 3220 })))
    ).toEqual(["meio"]);
  });

  it("test_filtros_area_m2_min_max_validos", () => {
    const list = [
      apt({ id: "peq", area: 66 }),
      apt({ id: "med", area: 96 }),
      apt({ id: "grd", area: 130 }),
    ];
    expect(ids(applyFilters(list, base({ areaMin: 70, areaMax: 130 })))).toEqual(
      ["med", "grd"]
    );
  });

  it("test_filtros_facilidades_multiplas_exige_todas_AND", () => {
    const list = [
      apt({ id: "ambas", features: ["Elevador", "Piscina"] }),
      apt({ id: "so-elevador", features: ["Elevador"] }),
      apt({ id: "nenhuma", features: ["Portaria 24h"] }),
    ];
    expect(
      ids(applyFilters(list, base({ facilities: ["Elevador", "Piscina"] })))
    ).toEqual(["ambas"]);
  });

  it("test_filtros_facilidade_ausente_no_schema_nao_exclui", () => {
    const list = [
      apt({ features: undefined as unknown as string[] }),
      apt({ id: "com", features: ["Elevador"] }),
    ];
    // Sem features = sem informação → passa (nunca quebra por dado ausente).
    expect(
      ids(applyFilters(list, base({ facilities: ["Elevador"] })))
    ).toHaveLength(2);
  });

  it("test_filtros_negacao_sem_elevador_nao_casa", () => {
    const list = [
      apt({ id: "neg", features: ["SEM ELEVADOR (3º andar)"] }),
      apt({ id: "pos", features: ["9º andar com elevador"] }),
    ];
    expect(ids(applyFilters(list, base({ facilities: ["Elevador"] })))).toEqual([
      "pos",
    ]);
  });

  it("test_filtros_pets_true_filtra_aceitam", () => {
    const list = [
      apt({ id: "sim", features: ["Aceita animais"] }),
      apt({ id: "nao", features: ["Não aceita animais"] }),
      apt({ id: "sem-info", features: [] }),
    ];
    // Explícito "não" sai; sem informação passa (regra do dado ausente).
    expect(ids(applyFilters(list, base({ pets: "yes" })))).toEqual([
      "sim",
      "sem-info",
    ]);
    expect(ids(applyFilters(list, base({ pets: "no" })))).toEqual([
      "nao",
      "sem-info",
    ]);
  });

  it("test_filtros_transacao_venda_usa_salePrice", () => {
    const list = [
      apt({
        id: "venda",
        transaction: "venda",
        salePrice: 500000,
        total: 999,
      }),
      apt({ id: "aluguel", total: 3220 }),
    ];
    // Venda filtra por salePrice (500000), não pelo total.
    expect(
      ids(applyFilters(list, base({ priceMin: 400000, priceMax: 800000 })))
    ).toEqual(["venda"]);
  });

  it("test_filtros_condoMax_e_noCondo", () => {
    const list = [
      apt({ id: "ok", condo: 580 }),
      apt({ id: "caro", condo: 750 }),
      apt({ id: "aconfirmar", condo: 0, condoUnknown: true }),
      apt({ id: "zero", condo: 0 }),
    ];
    expect(ids(applyFilters(list, base({ condoMax: 600 })))).toEqual([
      "ok",
      "aconfirmar",
      "zero",
    ]);
    expect(ids(applyFilters(list, base({ noCondo: true })))).toEqual(["zero"]);
  });

  it("test_filtros_dado_ausente_nao_quebra", () => {
    const list = [
      apt({
        bedrooms: undefined as unknown as number,
        area: undefined as unknown as number,
        total: undefined as unknown as number,
      }),
    ];
    const f = base({
      bedroomsMin: 3,
      areaMin: 70,
      priceMin: 1000,
      priceMax: 5000,
      facilities: ["Elevador"],
    });
    expect(() => applyFilters(list, f)).not.toThrow();
    expect(applyFilters(list, f)).toHaveLength(1);
  });

  it("test_filtros_combinacao_todos_grupos_AND", () => {
    const list = [
      apt({
        id: "alvo",
        title: "Apartamento Água Verde",
        bedrooms: 3,
        total: 3505,
        features: ["Elevador"],
      }),
      apt({
        id: "fora-preco",
        title: "Apartamento Água Verde",
        bedrooms: 3,
        total: 4412,
        features: ["Elevador"],
      }),
      apt({
        id: "fora-bairro",
        title: "Apartamento Batel",
        bedrooms: 3,
        total: 3505,
        features: ["Elevador"],
      }),
    ];
    const statusOf: Record<string, string> = {
      alvo: "novo",
      "fora-preco": "novo",
      "fora-bairro": "agendado",
    };
    const f = base({
      search: "água verde",
      bedroomsMin: 3,
      priceMax: 3800,
      facilities: ["Elevador"],
      status: "novo",
    });
    expect(ids(applyFilters(list, f, (id) => statusOf[id]))).toEqual(["alvo"]);
  });

  it("test_ordenacao_preco_crescente_e_decrescente", () => {
    const list = [
      apt({ id: "caro", total: 4412 }),
      apt({ id: "barato", total: 2350 }),
      apt({ id: "meio", total: 3220 }),
    ];
    expect(ids(applySort(list, "menor-preco"))).toEqual([
      "barato",
      "meio",
      "caro",
    ]);
    expect(ids(applySort(list, "maior-preco"))).toEqual([
      "caro",
      "meio",
      "barato",
    ]);
  });

  it("test_ordenacao_preco_m2_e_area", () => {
    const list = [
      apt({ id: "a", total: 2600, area: 100 }), // 26/m²
      apt({ id: "b", total: 3220, area: 90 }), // 35,8/m²
    ];
    expect(ids(applySort(list, "menor-preco-m2"))).toEqual(["a", "b"]);
    expect(ids(applySort(list, "maior-area"))).toEqual(["a", "b"]);
  });

  it("test_ordenacao_recentes_verifiedAt_primeiro", () => {
    const list = [
      apt({ id: "antigo", verifiedAt: "2026-09-20" }),
      apt({ id: "sem-data" }),
      apt({ id: "novo", verifiedAt: "2026-09-22" }),
    ];
    expect(ids(applySort(list, "recentes"))).toEqual([
      "novo",
      "antigo",
      "sem-data",
    ]);
  });

  it("test_filtros_facilidades_vazio_nao_exclui", () => {
    const list = [apt({ id: "vazio", features: [] })];
    expect(
      ids(applyFilters(list, base({ facilities: ["Elevador"] })))
    ).toEqual(["vazio"]);
  });

  it("test_ordenacao_maior_preco_nulo_por_ultimo", () => {
    const list = [
      apt({ id: "nulo", total: undefined as unknown as number }),
      apt({ id: "barato", total: 2350 }),
    ];
    expect(ids(applySort(list, "maior-preco"))).toEqual(["barato", "nulo"]);
    expect(ids(applySort(list, "menor-preco"))).toEqual(["barato", "nulo"]);
  });

  it("test_filtros_mobiliado_sim_exige_mobiliado", () => {
    const list = [
      apt({ id: "mob", features: ["Mobiliado", "Elevador"] }),
      apt({ id: "vazio", features: ["Elevador"] }),
      apt({ id: "sem-info", features: [] }),
    ];
    expect(ids(applyFilters(list, base({ furnished: "yes" })))).toEqual([
      "mob",
      "sem-info",
    ]);
  });

  it("test_filtros_mobiliado_nao_exclui_mobiliado", () => {
    const list = [
      apt({ id: "mob", features: ["Mobiliado"] }),
      apt({ id: "vazio", features: ["Elevador"] }),
      apt({ id: "sem-info", features: [] }),
    ];
    expect(ids(applyFilters(list, base({ furnished: "no" })))).toEqual([
      "vazio",
      "sem-info",
    ]);
  });

  it("test_filtros_contador_ativos_conta_corretamente", () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    const f = base({
      search: "batel",
      bedroomsMin: 3,
      facilities: ["Elevador", "Piscina"],
      status: "agendado",
      sort: "menor-preco", // ordenação não é filtro — não conta
    });
    expect(countActiveFilters(f)).toBe(5);
  });
});
