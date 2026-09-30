import { test, expect, type Page } from "@playwright/test";
import { type Apartment } from "@/lib/data";
import { NEIGHBORHOOD_ALL } from "@/lib/constants";
import { USER_ADDED_KEY } from "@/lib/pool";
import { signInIfNeeded } from "./open-app";
import { activePool } from "./pool-count";

// Filtros do QUADRO (leva kanban-filtros) contra o DOM. O I2 cobriu a função
// pura (19 testes unitários); o que faltava era a integração: abrir o painel,
// marcar um grupo, ver o recorte chegar na tela e sobreviver ao reload. Tudo
// aqui deriva do dado — nenhum literal de base, nenhuma contagem fixa.

const KANBAN_FILTERS_KEY = "apartamentos-app-kanban-filters";
const SEARCH_FILTERS_KEY = "apartamentos-app-filters";

type Group = ReturnType<Page["getByRole"]>;

/**
 * Checkbox de filtro pelo rótulo visível.
 *
 * `CheckGroup` (KanbanSection) marca cada opção como `<label><input
 * type="checkbox"><span>{rótulo}</span></label>` — o papel acessível do
 * elemento clicável é `checkbox`, não `button`, e o nome vem do label
 * envolvente. Procurar `button` não acha nada (e o `Etapa do funil` ainda
 *suffixa a contagem por etapa no rótulo, ex.: "Contactado (3)").
 */
function opcao(group: Group, nome: string | RegExp) {
  return group.getByRole("checkbox", { name: nome });
}

/** Imóvel do usuário, com bairro/origem/pricing escolhidos pelo teste. */
function fake(id: string, patch: Partial<Apartment> = {}): Apartment {
  return {
    id,
    title: `Imóvel ${id}`,
    neighborhood: "Bairro Alfa",
    address: "Rua de teste, Curitiba",
    area: 70,
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
    rent: 2500,
    condo: 0,
    iptu: 0,
    total: 2500,
    phone: "41999999999",
    email: "",
    link: "https://exemplo.com/imovel",
    image: "/imoveis/zap-portao-124-5525.webp",
    features: [],
    description: "Imóvel usado no e2e de filtros do quadro.",
    source: "Portal Alfa",
    ...patch,
  };
}

/** Semeia o pool extra e o estado, entra no app e abre o quadro. */
async function quadro(page: Page, opts: { pool?: Apartment[]; state?: object } = {}) {
  if (opts.pool) {
    await page.addInitScript(
      ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
      { key: USER_ADDED_KEY, value: opts.pool },
    );
  }
  await page.addInitScript((s) => {
    localStorage.setItem(
      "apartamentos-app-state",
      JSON.stringify({
        isAuthenticated: true,
        username: "guinness",
        notes: [],
        statuses: [],
        followUps: {},
        ...s,
      }),
    );
  }, opts.state ?? {});
  await page.goto("/");
  await signInIfNeeded(page);
  await page.locator('[data-view-mode="quadro"]').click();
  const view = page.getByTestId("kanban-view");
  await expect(view).toBeVisible();
  return view;
}

async function abrirFiltros(page: Page) {
  const view = page.getByTestId("kanban-view");
  const botao = view.getByRole("button", { name: /^Filtros/ });
  await botao.click();
  const painel = view.getByRole("region", { name: "Filtros do quadro" });
  await expect(painel).toBeVisible();
  await expect(botao).toHaveAttribute("aria-expanded", "true");
  return {
    view,
    painel,
    etapas: painel.getByRole("group", { name: "Etapa do funil" }),
    origem: painel.getByRole("group", { name: "Origem" }),
    bairro: painel.getByRole("group", { name: "Bairro" }),
    faixa: painel.getByRole("group", { name: "All-in por mês" }),
    quartos: painel.getByRole("group", { name: "Quartos (mínimo)" }),
    area: painel.getByRole("group", { name: "Área (mínima)" }),
  };
}

/** Nº de imóveis visíveis, lido da barra de recorte (não de contar card). */
function visiveis(page: Page) {
  return page.getByTestId("kanban-visible-count");
}

// Réplica das REGRAS de applyKanbanFilters para esperar o número no dado. O
// dado ausente nunca exclui (mesma regra do app) — daí o `?? Infinity`.
const porBairro = (b: string) => activePool().pool.filter((a) => a.neighborhood === b);
const porOrigem = (o: string) =>
  activePool().pool.filter((a) => (a.source ?? "").trim() === o);
const comQuartos = (n: number) =>
  activePool().pool.filter((a) => (a.bedrooms ?? Number.POSITIVE_INFINITY) >= n);
const comArea = (n: number) =>
  activePool().pool.filter((a) => (a.area ?? Number.POSITIVE_INFINITY) >= n);

test("test_kanban_filtros_abrem_no_painel_e_recortam_o_quadro", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const base = activePool().total;
  await quadro(page);
  const f = await abrirFiltros(page);

  // Ponto de partida: nada marcado = tudo visível, e "Limpar tudo" nem existe.
  await expect(visiveis(page)).toHaveText(`${base} de ${base} imóveis visíveis`);
  await expect(f.view.getByRole("button", { name: "Limpar tudo" })).toHaveCount(0);

// --- Origem: o portal do 1º imóvel da base (o rótulo é a `source` normalizada,
  // então o valor vem do dado e nunca casa 0 por acidente).
  const origem = activePool().pool[0].source?.trim() || "sem origem";
  await opcao(f.origem, origem).check();
  await expect(visiveis(page)).toHaveText(
    `${porOrigem(origem).length} de ${base} imóveis visíveis`,
  );
  await expect(f.view.getByRole("button", { name: /^Filtros \(1\)/ })).toBeVisible();

  // --- AND entre grupos: origem + bairro.
  const bairro = activePool().pool[0].neighborhood;
  await opcao(f.bairro, bairro).check();
  const ambos = activePool().pool.filter(
    (a) => (a.source ?? "").trim() === origem && a.neighborhood === bairro,
  );
  await expect(visiveis(page)).toHaveText(
    `${ambos.length} de ${base} imóveis visíveis`,
  );
  await expect(f.view.getByRole("button", { name: /^Filtros \(2\)/ })).toBeVisible();

  // Desmarcar a origem volta ao recorte só de bairro.
  await opcao(f.origem, origem).uncheck();
  await expect(visiveis(page)).toHaveText(
    `${porBairro(bairro).length} de ${base} imóveis visíveis`,
  );

  // --- Faixa de all-in: a primeira faixa (até R$ 2.000).
  await opcao(f.bairro, bairro).uncheck();
  await opcao(f.faixa, /^até R\$/).check();
  const ate2000 = activePool().pool.filter((a) => a.total < 2000);
  await expect(visiveis(page)).toHaveText(
    `${ate2000.length} de ${base} imóveis visíveis`,
  );
  // O intervalo é exclusivo no fim (TOTAL_BANDS: `total >= min && total < max`).
  expect(
    ate2000.length,
    "a faixa 'até R$ 2.000' casou 0 — a base mudou e a faixa precisa ser reescolhida",
  ).toBeGreaterThan(0);

  // --- Quartos e área: mínimos marcados, vale o menor.
  await opcao(f.faixa, /^até R\$/).uncheck();
  await opcao(f.quartos, /^3\+/).check();
  await expect(visiveis(page)).toHaveText(
    `${comQuartos(3).length} de ${base} imóveis visíveis`,
  );

  await opcao(f.area, /^70 m²\+/).check();
  const ambosMin = activePool().pool.filter(
    (a) =>
      (a.bedrooms ?? Number.POSITIVE_INFINITY) >= 3 &&
      (a.area ?? Number.POSITIVE_INFINITY) >= 70,
  );
  await expect(visiveis(page)).toHaveText(
    `${ambosMin.length} de ${base} imóveis visíveis`,
  );

  // Limpar tudo volta ao pool inteiro e some o badge.
  await f.view.getByRole("button", { name: "Limpar tudo" }).click();
  await expect(visiveis(page)).toHaveText(`${base} de ${base} imóveis visíveis`);
  await expect(f.view.getByRole("button", { name: "Limpar tudo" })).toHaveCount(0);
  // Nenhum checkbox ficou marcado.
  await expect(f.painel.locator('input[type="checkbox"]:checked')).toHaveCount(0);

  expect(errors, `erros de página: ${errors.join(" | ")}`).toEqual([]);
});

test("test_kanban_filtros_persistem_no_reload_sem_tocar_a_busca", async ({ page }) => {
  const base = activePool().total;
  await quadro(page);
  const f = await abrirFiltros(page);

  // Bairro e mínimo de quartos saem de um imóvel que realmente tem 3+ quartos:
  // combinar "bairro do 1º card" com "3+" dá 0 numa base onde o 1º card tem 2
  // quartos (era o que fazia a combinação nascer vazia).
  const referencia = activePool().pool.find(
    (a) => (a.bedrooms ?? 0) >= 3,
  );
  expect(referencia, "a base do perfil ativo não tem nenhum imóvel com 3+ quartos").toBeTruthy();
  const bairro = referencia!.neighborhood;
  await opcao(f.bairro, bairro).check();
  await opcao(f.quartos, /^3\+/).check();
  const esperado = activePool().pool.filter(
    (a) =>
      a.neighborhood === bairro &&
      (a.bedrooms ?? Number.POSITIVE_INFINITY) >= 3,
  );
  expect(esperado.length).toBeGreaterThan(0);

  // As duas chaves são independentes. O que se prova aqui não é "a chave da busca
  // não existe" (o Dashboard grava o estado padrão dela assim que hidrata), e sim
  // que o recorte do quadro NÃO vazou para a busca e vice-versa: nenhum campo
  // exclusivo de um aparece no outro, e o bairro marcado no quadro não mudou o
  // filtro de bairro da busca. É a consequência observável de uma colisão de
  // chave — e nada mais acusaria.
  const chaves = await page.evaluate(
    (k) => ({
      kanban: localStorage.getItem(k.kanban),
      busca: localStorage.getItem(k.busca),
    }),
    { kanban: KANBAN_FILTERS_KEY, busca: SEARCH_FILTERS_KEY },
  );
  expect(chaves.kanban, "recorte do quadro não foi salvo").toBeTruthy();
  expect(chaves.kanban).toContain(bairro);
  const kanban = JSON.parse(chaves.kanban!) as Record<string, unknown>;
  expect(kanban.neighborhoods).toEqual([bairro]);
  expect(kanban.bedrooms).toEqual([3]);
  // Campo da busca que não existe no recorte do quadro.
  expect(kanban, "a chave do quadro guardou estado da busca").not.toHaveProperty("sort");

  expect(chaves.busca).toBeTruthy();
  const busca = JSON.parse(chaves.busca!) as {
    filters: Record<string, unknown>;
  };
  for (const campo of ["sources", "totalBands", "columns"]) {
    expect(
      busca.filters,
      `campo do quadro (${campo}) vazou para a chave da busca`,
    ).not.toHaveProperty(campo);
  }
  expect(busca.filters.neighborhood, "o bairro marcado no quadro mudou a busca").toBe(
    NEIGHBORHOOD_ALL,
  );

  await page.reload();
  await signInIfNeeded(page);
  await expect(page.getByTestId("kanban-view")).toBeVisible();

  // O recorte voltou: a barra conta o estado, antes mesmo do painel reabrir.
  await expect(visiveis(page)).toHaveText(`${esperado.length} de ${base} imóveis visíveis`);
  const f2 = await abrirFiltros(page);
  await expect(opcao(f2.bairro, bairro)).toBeChecked();
  await expect(opcao(f2.quartos, /^3\+/)).toBeChecked();
});

// ---------------------------------------------------------------------------
// Drag & drop com filtro ATIVO — a correção do `realIndexFromVisual` NÃO fecha
// o caso. Achado de QA (o I2 tinha coberto só a função pura, em unit).
//
// A situação: 5 cards na mesma coluna (A..E, `index` 0..4), filtro de bairro
// deixando visíveis A, C e E (B e D escondidos), e E arrastado para a metade de
// cima de C. O que o usuário pediu é "E logo antes de C" — na coluna INTEIRA
// isso é a ordem [A, B, E, C, D], com B ainda na frente.
//
// O que acontece: `move(E, contactado, 1)` persiste [A, E, B, C, D]. E o motivo
// é estrutural, não um índice trocado: `KanbanSection` passa `apartments={
// visiveis}` para o board, ou seja, `KanbanBoard` só enxerga os cards que o
// filtro deixou. Logo `col.ids` JÁ é a lista filtrada ([A, C, E]) e o
// `realIndexFromVisual(columnIds, visibleIds, ...)` recebe os dois parâmetros
// iguais — que é exatamente o caso que o próprio comentário da função chama de
// "degenera no índice antigo". A correção serve para o `staleOnly` e para o cap
// do "+N restantes" (esses dois filtram DENTRO do board, então os dois parâmetros
// divergem de verdade), mas para o filtro do quadro ela é no-op: o índice
// visual continua sendo aplicado pelo `moveCard` à coluna completa.
//
// Conserto possível (fora do escopo do agente de QA, `app/components/**`): o
// board precisa da coluna completa para casar slot visual → índice real, ou o
// `moveCardTo` precisa receber o id de âncora em vez de um índice.
//
// A ordem VISÍVEL ([A, E, C]) é a mesma com e sem o bug — por isso a prova é o
// índice real persistido, e não a tela.
// ---------------------------------------------------------------------------
// A anotação fica DENTRO do teste (e não no topo do arquivo) de propósito:
// `test.fail(true, …)` no escopo de arquivo vale para os três testes do spec, e
// os outros dois passam — o Playwright acusaria "Expected to fail, but passed".
test("test_kanban_drag_drop_com_filtro_ativo_usa_indice_real", async ({ page }) => {
  test.fail(
    true,
    "arrastar com filtro do quadro ligado grava o índice visual na coluna inteira (B é atropelado): o board recebe só a lista filtrada, então realIndexFromVisual degenera. Corrigir app/components/KanbanSection.tsx + KanbanBoard.tsx e remover esta anotação",
  );
  const imoveis = [
    fake("qa-A", { neighborhood: "Bairro Alfa" }),
    fake("qa-B", { neighborhood: "Bairro Beta" }),
    fake("qa-C", { neighborhood: "Bairro Alfa" }),
    fake("qa-D", { neighborhood: "Bairro Beta" }),
    fake("qa-E", { neighborhood: "Bairro Alfa" }),
  ];
  const statuses = imoveis.map((a, i) => ({
    apartmentId: a.id,
    status: "contactado",
    updatedAt: "2026-09-24T00:00:00.000Z",
    index: i,
  }));

  await quadro(page, { pool: imoveis, state: { statuses } });
  const view = page.getByTestId("kanban-view");
  const col = view.getByRole("region", { name: /^Contactado/ });
  const art = col.locator("article");
  await expect(art).toHaveCount(5);
  await expect(art.nth(0)).toContainText("qa-A");
  await expect(art.nth(4)).toContainText("qa-E");

  // Filtro que deixa só A, C e E visíveis (a coluna inteira tem 5).
  const f = await abrirFiltros(page);
  await opcao(f.bairro, "Bairro Alfa").check();
  await expect(art).toHaveCount(3);
  await expect(art.nth(0)).toContainText("qa-A");
  await expect(art.nth(1)).toContainText("qa-C");
  await expect(art.nth(2)).toContainText("qa-E");

  // Arrasta E para a metade de cima de C (o 2º visível).
  await art.nth(2).dragTo(art.nth(1), { targetPosition: { x: 20, y: 3 } });

  // Visualmente E ficou acima de C.
  await expect(art.nth(0)).toContainText("qa-A");
  await expect(art.nth(1)).toContainText("qa-E");
  await expect(art.nth(2)).toContainText("qa-C");

  // E o índice REAL é o de C (2), não o visual (1): B não pode ter sido
  // atropelado. Hoje persiste A, E, B, C, D.
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("apartamentos-app-state") ?? "{}"),
  );
  const order = (persisted.statuses ?? [])
    .filter((s: { status: string }) => s.status === "contactado")
    .sort(
      (x: { index?: number }, y: { index?: number }) =>
        (x.index ?? 0) - (y.index ?? 0),
    )
    .map((s: { apartmentId: string }) => s.apartmentId);
  expect(order, `ordem real da coluna: ${order.join(" > ")}`).toEqual([
    "qa-A",
    "qa-B",
    "qa-E",
    "qa-C",
    "qa-D",
  ]);

  await expect(view.locator('[aria-live="polite"]')).toContainText(
    /movido para Contactado/,
  );
});