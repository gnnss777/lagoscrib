import { describe, expect, it } from "vitest";
import {
  DEFAULT_KANBAN_FILTERS,
  KANBAN_FILTERS_STORAGE_KEY,
  KANBAN_FILTERS_STORAGE_VERSION,
  SEM_ORIGEM,
  TOTAL_BANDS,
  applyKanbanFilters,
  countActiveKanbanFilters,
  kanbanFilterOptions,
  parseKanbanFilters,
  sourceKey,
  totalBandId,
  type KanbanFilters,
} from "@/app/components/KanbanSection";
import {
  kanbanColumns,
  realIndexFromVisual,
} from "@/app/components/KanbanBoard";
import {
  DEFAULT_COLUMN_CONFIG,
  moveCard,
  type ApartmentStatus,
  type StatusType,
} from "@/lib/kanban";
import type { Apartment } from "@/lib/data";

// Filtros do quadro (leva kanban-filtros) + a correção do drop indexado.
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
// Regra dura herdada de lib/filters: dado ausente nunca exclui.

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

const base = (over: Partial<KanbanFilters> = {}): KanbanFilters => ({
  ...DEFAULT_KANBAN_FILTERS,
  ...over,
});

const ids = (list: Apartment[]): string[] => list.map((a) => a.id);

// Etapa de todos = "novo", salvo o mapa do caso.
const noStatus = () => "novo" as StatusType;

describe("kanban filtros", () => {
  it("test_quadro_padrao_deixa_tudo_visivel", () => {
    const list = [
      apt({ id: "a" }),
      apt({ id: "b", source: "zap" }),
      apt({ id: "c", neighborhood: "Batel" }),
    ];
    expect(ids(applyKanbanFilters(list, base(), noStatus))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("test_quadro_origem_seleciona_um_portal", () => {
    const list = [
      apt({ id: "zap", source: "zap" }),
      apt({ id: "olx", source: "olx" }),
      apt({ id: "apolar", source: "apolar" }),
    ];
    expect(ids(applyKanbanFilters(list, base({ sources: ["olx"] }), noStatus))).toEqual([
      "olx",
    ]);
  });

  it("test_quadro_origem_multi_selecao_agrupa_vazios_como_sem_origem", () => {
    const list = [
      apt({ id: "zap", source: "zap" }),
      apt({ id: "olx", source: "olx" }),
      apt({ id: "nada" }),
      apt({ id: "branco", source: "   " }),
    ];
    // Sem `source` e com `source` em branco são o mesmo grupo.
    expect(sourceKey(apt({ source: "  " }))).toBe(SEM_ORIGEM);
    expect(
      ids(applyKanbanFilters(list, base({ sources: [SEM_ORIGEM] }), noStatus)),
    ).toEqual(["nada", "branco"]);
    // Marcar duas origens = OU, não E.
    expect(
      ids(
        applyKanbanFilters(list, base({ sources: ["zap", "olx"] }), noStatus),
      ),
    ).toEqual(["zap", "olx"]);
  });

  it("test_quadro_bairro_filtra_por_nome", () => {
    const list = [
      apt({ id: "centro", neighborhood: "Centro" }),
      apt({ id: "batel", neighborhood: "Batel" }),
    ];
    expect(
      ids(applyKanbanFilters(list, base({ neighborhoods: ["Batel"] }), noStatus)),
    ).toEqual(["batel"]);
  });

  it("test_quadro_faixa_allin_usa_total_e_nao_rent", () => {
    const barato = apt({ id: "barato", rent: 1200, total: 1900 });
    const caro = apt({ id: "caro", rent: 1200, total: 5200 });
    const banda = TOTAL_BANDS[0].id;
    // Mesmo aluguel, all-in diferente: quem filtra por faixa separa os dois.
    expect(barato.rent).toBe(caro.rent);
    expect(ids(applyKanbanFilters([barato, caro], base({ totalBands: [banda] }), noStatus))).toEqual([
      "barato",
    ]);
    expect(totalBandId(1900)).toBe(banda);
    expect(totalBandId(5200)).toBe(TOTAL_BANDS[3].id);
    // Fronteira: a faixa é [min, max).
    expect(totalBandId(2000)).toBe(TOTAL_BANDS[1].id);
    expect(totalBandId(6000)).toBe(TOTAL_BANDS[4].id);
  });

  it("test_quadro_quartos_minimo_usa_o_menor_marcado", () => {
    const list = [
      apt({ id: "q1", bedrooms: 1 }),
      apt({ id: "q2", bedrooms: 2 }),
      apt({ id: "q3", bedrooms: 3 }),
    ];
    expect(ids(applyKanbanFilters(list, base({ bedrooms: [3] }), noStatus))).toEqual([
      "q3",
    ]);
    // OR entre mínimos marcados: o menor vale.
    expect(
      ids(applyKanbanFilters(list, base({ bedrooms: [2, 3] }), noStatus)),
    ).toEqual(["q2", "q3"]);
  });

  it("test_quadro_area_minima_filtra_e_dado_ausente_passa", () => {
    const list = [
      apt({ id: "pequeno", area: 45 }),
      apt({ id: "grande", area: 120 }),
      apt({ id: "sem_area", area: undefined as unknown as number }),
    ];
    expect(
      ids(
        applyKanbanFilters(
          [list[0], list[1]],
          base({ area: [100] }),
          noStatus,
        ),
      ),
    ).toEqual(["grande"]);
    // Sem área não se descarta o imóvel (schema aditivo).
    expect(ids(applyKanbanFilters(list, base({ area: [100] }), noStatus))).toEqual([
      "grande",
      "sem_area",
    ]);
  });

  it("test_quadro_filtro_por_coluna_usa_a_etapa_do_funil", () => {
    const lista: Apartment[] = [apt({ id: "a" }), apt({ id: "b" }), apt({ id: "c" })];
    const statusOf = (id: string): StatusType =>
      id === "b" ? "negociacao" : "novo";
    expect(ids(applyKanbanFilters(lista, base({ columns: ["negociacao"] }), statusOf))).toEqual([
      "b",
    ]);
    expect(
      ids(applyKanbanFilters(lista, base({ columns: ["novo", "negociacao"] }), statusOf)),
    ).toEqual(["a", "b", "c"]);
  });

  it("test_quadro_filtros_sao_and_entre_grupos", () => {
    const lista: Apartment[] = [
      apt({ id: "bate-tudo", source: "zap", neighborhood: "Batel", bedrooms: 3, total: 2600 }),
      apt({ id: "bate-1q", source: "zap", neighborhood: "Batel", bedrooms: 1, total: 2600 }),
      apt({ id: "bate-pago", source: "zap", neighborhood: "Batel", bedrooms: 3, total: 5200 }),
      apt({ id: "outro-bairro", source: "zap", neighborhood: "Centro", bedrooms: 3, total: 2600 }),
      apt({ id: "outro-portal", source: "olx", neighborhood: "Batel", bedrooms: 3, total: 2600 }),
    ];
    const recorte = base({
      sources: ["zap"],
      neighborhoods: ["Batel"],
      bedrooms: [2],
      totalBands: [TOTAL_BANDS[1].id],
    });
    expect(ids(applyKanbanFilters(lista, recorte, noStatus))).toEqual(["bate-tudo"]);
  });

  it("test_quadro_limpar_tudo_zera_o_recorte", () => {
    const recorte = base({
      sources: ["zap"],
      neighborhoods: ["Batel"],
      totalBands: [TOTAL_BANDS[1].id],
      bedrooms: [3],
      area: [70],
      columns: ["novo"],
    });
    expect(countActiveKanbanFilters(recorte)).toBe(6);
    expect(countActiveKanbanFilters(DEFAULT_KANBAN_FILTERS)).toBe(0);
    // "Limpar tudo" devolve o default: o pool inteiro volta.
    const limpo = base();
    expect(countActiveKanbanFilters(limpo)).toBe(0);
    expect(
      ids(applyKanbanFilters([apt({ id: "a" }), apt({ id: "b" })], limpo, noStatus)),
    ).toEqual(["a", "b"]);
  });

  it("test_quadro_persiste_recorte_em_localstorage", () => {
    // A chave é deste componente (KanbanSection é remontado a cada troca de
    // aba), então o recorte salvo precisa ser reidratado em JSON versionado.
    const salvo = JSON.stringify({
      ...base({ sources: ["zap"], columns: ["negociacao"], bedrooms: [2] }),
      version: KANBAN_FILTERS_STORAGE_VERSION,
    });
    const lido = parseKanbanFilters(salvo);
    expect(KANBAN_FILTERS_STORAGE_KEY).toBe("apartamentos-app-kanban-filters");
    expect(lido.sources).toEqual(["zap"]);
    expect(lido.columns).toEqual(["negociacao"]);
    expect(lido.bedrooms).toEqual([2]);
    expect(countActiveKanbanFilters(lido)).toBe(3);
  });

  it("test_quadro_parse_tolerante_lixo_e_versao_velha_vao_ao_default", () => {
    const vazio = DEFAULT_KANBAN_FILTERS;
    for (const lixo of [
      "",
      "{quebrado",
      "null",
      "[]",
      JSON.stringify({ version: 99, sources: ["zap"] }),
      JSON.stringify({ sources: ["zap"] }),
      JSON.stringify({ ...vazio, version: KANBAN_FILTERS_STORAGE_VERSION, sources: [1, null, "  "] }),
      undefined,
      42,
    ]) {
      expect(parseKanbanFilters(lixo)).toEqual(vazio);
    }
    // Valor fora do domínio é descartado, o resto sobrevive.
    expect(
      parseKanbanFilters(
        JSON.stringify({
          version: KANBAN_FILTERS_STORAGE_VERSION,
          sources: ["zap", 7, ""],
          totalBands: ["faixa-inexistente"],
          columns: ["descartado"],
          bedrooms: [-1, 3, "3"],
        }),
      ),
    ).toEqual({
      version: KANBAN_FILTERS_STORAGE_VERSION,
      sources: ["zap"],
      neighborhoods: [],
      totalBands: [],
      bedrooms: [3],
      area: [],
      columns: [],
    });
  });

  it("test_quadro_opcoes_sao_derivadas_do_pool", () => {
    const lista: Apartment[] = [
      apt({ id: "a", source: "zap", neighborhood: "Batel", area: 45, bedrooms: 2, total: 1900 }),
      apt({ id: "b", source: "olx", neighborhood: "Água Verde", area: 90, bedrooms: 4, total: 5200 }),
      apt({ id: "c", neighborhood: "Batel", area: 45, bedrooms: 2, total: 1900 }),
    ];
    const opcoes = kanbanFilterOptions(lista);
    expect(opcoes.sources.map((o) => o.value)).toEqual(["olx", SEM_ORIGEM, "zap"]);
    expect(opcoes.neighborhoods.map((o) => o.value)).toEqual(["Água Verde", "Batel"]);
    // Só entram as faixas e os degraus que o pool atende.
    expect(opcoes.totalBands.map((o) => o.value)).toEqual([
      TOTAL_BANDS[0].id,
      TOTAL_BANDS[3].id,
    ]);
    expect(opcoes.bedrooms.map((o) => o.value)).toEqual([1, 2, 3, 4]);
    expect(opcoes.area.map((o) => o.value)).toEqual([30, 40, 50, 60, 70, 80]);
  });

  it("test_quadro_contagem_por_coluna_mostra_o_funil_inteiro", () => {
    const lista: Apartment[] = [apt({ id: "a" }), apt({ id: "b" }), apt({ id: "c" })];
    const statuses: ApartmentStatus[] = [
      { apartmentId: "b", status: "negociacao", updatedAt: "2026-09-01", index: 0 },
    ];
    // "c" sem entrada: entra sintetizado em "novo", no fim.
    const colunas = kanbanColumns(lista, statuses, {}, DEFAULT_COLUMN_CONFIG);
    // As 8 etapas do funil continuam disponíveis (etapa vazia ainda é
    // selecionável); só estas têm card.
    expect(colunas).toHaveLength(8);
    expect(
      colunas.filter((c) => c.ids.length > 0).map((c) => `${c.status}:${c.ids.length}`),
    ).toEqual(["novo:2", "negociacao:1"]);
  });
});

describe("kanban drop com filtro", () => {
  // Regressão do slotFromPoint: ele conta os cards VISÍVEIS, mas o moveCard
  // consome o índice REAL da coluna. Sem filtro os dois são o mesmo número;
  // com filtro, não — e o card caía na posição errada.

  const ordem = (prev: ApartmentStatus[], status: StatusType): string[] =>
    prev
      .filter((e) => e.status === status)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((e) => e.apartmentId);

  const entrada = (
    apartmentId: string,
    status: StatusType,
    index: number,
  ): ApartmentStatus => ({ apartmentId, status, updatedAt: "", index });

  it("test_quadro_drop_sem_filtro_mantem_ordem_antiga", () => {
    const columnIds = ["a", "b", "c"];
    // Visual 1 = entre "b" e "c" → índice real 1.
    expect(realIndexFromVisual(columnIds, columnIds, "x", 1)).toBe(1);
    expect(realIndexFromVisual(columnIds, columnIds, "x", 3)).toBe(3);
    // Arrastando o próprio "a" para baixo: slot visual 2 = entre b e c, e o
    // índice do destino é o de "c" (que o moveCard empurra para +1).
    expect(realIndexFromVisual(columnIds, columnIds, "a", 2)).toBe(2);
  });

  it("test_quadro_drop_com_filtro_usa_indice_real_da_coluna", () => {
    // Filtro esconde h1/h2: na tela aparecem só v1, v2, v3.
    const prev = [
      entrada("h1", "novo", 0),
      entrada("h2", "novo", 1),
      entrada("v1", "novo", 2),
      entrada("v2", "novo", 3),
      entrada("v3", "novo", 4),
    ];
    const columnIds = ordem(prev, "novo");
    const visibleIds = ["v1", "v2", "v3"];

    // Solta entre v1 e v2 (posição visual 1). A resposta ingenua seria 1 —
    // que colocaria o card entre h1 e h2, entre os invisíveis.
    const alvo = realIndexFromVisual(columnIds, visibleIds, "x", 1);
    expect(alvo).toBe(3);
    expect(alvo).not.toBe(1);

    // moveCard (o dono da reindexação) produz a ordem que o usuário viu.
    const depois = ordem(
      moveCard(prev, "x", "novo", alvo, { now: "2026-09-30T00:00:00.000Z" }),
      "novo",
    );
    expect(depois).toEqual(["h1", "h2", "v1", "x", "v2", "v3"]);
    // O card caiu exatamente entre v1 e v2, como no ponteiro.
    expect(depois.indexOf("x")).toBe(depois.indexOf("v1") + 1);

    // O que o código antigo fazia (índice visual virando toIndex) gravava o
    // card ACIMA dos invisíveis — a posição errada que o filtro acordou.
    const ingenuo = ordem(
      moveCard(prev, "x", "novo", 1, { now: "2026-09-30T00:00:00.000Z" }),
      "novo",
    );
    expect(ingenuo).toEqual(["h1", "x", "h2", "v1", "v2", "v3"]);
    expect(ingenuo).not.toEqual(depois);
  });

  it("test_quadro_drop_com_filtro_reordena_dentro_da_mesma_coluna", () => {
    const prev = [
      entrada("h1", "novo", 0),
      entrada("v1", "novo", 1),
      entrada("v2", "novo", 2),
      entrada("v3", "novo", 3),
    ];
    const columnIds = ordem(prev, "novo");
    const visibleIds = ["v1", "v2", "v3"];

    // Arrasta v1 (slot visual 0) e solta entre v2 e v3 (slot visual 2).
    const alvo = realIndexFromVisual(columnIds, visibleIds, "v1", 2);
    expect(alvo).toBe(3);
    const depois = ordem(
      moveCard(prev, "v1", "novo", alvo, { now: "2026-09-30T00:00:00.000Z" }),
      "novo",
    );
    expect(depois).toEqual(["h1", "v2", "v1", "v3"]);
  });

  it("test_quadro_drop_no_fim_da_coluna_filtrada_vai_para_o_fim_real", () => {
    const prev = [
      entrada("h1", "novo", 0),
      entrada("v1", "novo", 1),
      entrada("v2", "novo", 2),
    ];
    const columnIds = ordem(prev, "novo");
    const visibleIds = ["v1", "v2"];

    // Slot visual 2 = fim da coluna na tela, mas não no índice real.
    const alvo = realIndexFromVisual(columnIds, visibleIds, "x", 2);
    expect(alvo).toBe(3);
    expect(
      ordem(moveCard(prev, "x", "novo", alvo, { now: "2026-09-30T00:00:00.000Z" }), "novo"),
    ).toEqual(["h1", "v1", "v2", "x"]);
  });

  it("test_quadro_drop_em_coluna_todo_filtrado_fora_vai_para_o_fim", () => {
    const prev = [entrada("h1", "novo", 0), entrada("h2", "novo", 1)];
    // Nada visível na coluna: o destino é o fim real.
    expect(realIndexFromVisual(["h1", "h2"], [], "x", 0)).toBe(2);
    // Slot visual antes do primeiro visível: entra na frente dele, não no 0.
    expect(realIndexFromVisual(["h1", "h2", "v1"], ["v1"], "x", 0)).toBe(2);
  });
});
