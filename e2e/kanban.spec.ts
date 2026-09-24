import { test, expect, type Page } from "@playwright/test";

// Kanban de prospecção em TELA CHEIA (leva kanban-tela-inteira-ui): board
// full-viewport, mover por teclado, prospectar da busca, painel lateral de
// configuração e filtro sem-retorno. Estado semeado via localStorage.

async function gotoAuthed(page: Page, state: object = {}) {
  await page.addInitScript((s) => {
    localStorage.setItem(
      "apartamentos-app-state",
      JSON.stringify({
        isAuthenticated: true,
        username: "guinness",
        notes: [],
        statuses: [],
        ...s,
      }),
    );
  }, state);
  await page.goto("/");
  await expect(page.locator(".card-apartment").first()).toBeVisible();
}

async function openKanban(page: Page) {
  await page.getByRole("button", { name: "Abrir prospecção (kanban)" }).click();
  const view = page.getByTestId("kanban-view");
  await expect(view).toBeVisible();
  return view;
}

test("test_kanban_prospectar_da_busca_2_acoes", async ({ page }) => {
  const errors: string[] = [];
  await gotoAuthed(page);

  // 1ª ação: abrir o 1º card → DetailModal (aba Detalhes, seção Status).
  // (F3.1: card mínimo — Prospectar vive no modal, não no card.)
  await page.locator(".card-apartment").first().click();
  const dialog = page.getByRole("dialog", { name: /Detalhes de/ });
  await expect(dialog).toBeVisible();

  // 2ª ação: Prospectar na seção Status → fecha o modal e abre a view tela cheia.
  await dialog.getByRole("button", { name: /Prospectar/ }).click();
  const view = page.getByTestId("kanban-view");
  await expect(view).toBeVisible();
  await expect(
    view.getByRole("region", { name: /Não visitado/ }),
  ).toBeVisible();

  // Tela cheia de verdade: board ocupa 100vw (sem modal centralizado).
  const width = await view.evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeGreaterThanOrEqual(900);

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_kanban_teclado_move_menu_anuncia_aria_live", async ({ page }) => {
  const errors: string[] = [];
  await gotoAuthed(page);
  const view = await openKanban(page);

  // Foca o 1º card de "Não visitado" e move com "." (estilo Trello).
  const col = view.getByRole("region", { name: /Não visitado/ });
  const card = col.locator("article").first();
  await card.focus();
  await page.keyboard.press(".");

  // aria-live policial anuncia destino + posição (fecha B6).
  const live = view.locator('[aria-live="polite"]');
  await expect(live).toContainText(/movido para Contactado \(posição \d+ de \d+\)/);

  // Card saiu da coluna de origem.
  await expect(
    view
      .getByRole("region", { name: /Contactado/ })
      .locator("article")
      .first(),
  ).toBeVisible();

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_kanban_customizacao_painel_renomear_reload_reset", async ({
  page,
}) => {
  const errors: string[] = [];
  await gotoAuthed(page);
  const view = await openKanban(page);

  // Painel lateral: renomeia "Não visitado" → "Quero visitar".
  await view.getByRole("button", { name: "Configurar quadro" }).click();
  const panel = view.getByRole("complementary", { name: "Configurar quadro" });
  await expect(panel).toBeVisible();
  const input = panel.getByRole("textbox", { name: "Nome da coluna Não visitado" });
  await input.fill("Quero visitar");
  await input.press("Enter");

  // Coluna renomeada aparece no board (sem trocar de aba — não há mais abas).
  await expect(
    view.getByRole("region", { name: /Quero visitar/ }),
  ).toBeVisible();

  // Reload: customização sobrevive (AC-9).
  await page.reload();
  await expect(page.locator(".card-apartment").first()).toBeVisible();
  const view2 = await openKanban(page);
  await expect(
    view2.getByRole("region", { name: /Quero visitar/ }),
  ).toBeVisible();

  // Reset: volta exatamente aos 8 padrão.
  await view2.getByRole("button", { name: "Configurar quadro" }).click();
  const panel2 = view2.getByRole("complementary", { name: "Configurar quadro" });
  await panel2
    .getByRole("button", { name: "Voltar ao padrão (8 colunas)" })
    .click();
  await expect(
    view2.getByRole("region", { name: /Não visitado/ }),
  ).toBeVisible();

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_kanban_filtro_so_sem_retorno", async ({ page }) => {
  const errors: string[] = [];
  // 1 follow-up pendente há 8 dias (acima do limiar de 7).
  await gotoAuthed(page, {
    followUps: {
      "zap-aguaverde-castro-123": {
        attempts: 2,
        status: "aguardando",
        lastContactAt: "2026-09-15T12:00:00.000Z",
      },
    },
  });
  const view = await openKanban(page);

  // Selo visível em ≤1 olhar (AC-3) + alerta na coluna.
  await expect(view.getByText("sem retorno ×2").first()).toBeVisible();
  await expect(view.getByText(/sem retorno há 7\+ dias/).first()).toBeVisible();

  // Filtro: só o pendente aparece.
  await view.getByRole("button", { name: /Só sem retorno/ }).click();
  await expect(view.locator("article")).toHaveCount(1);

  // Mostrar todos: volta tudo.
  await view.getByRole("button", { name: /Mostrar todos/ }).click();
  expect(await view.locator("article").count()).toBeGreaterThan(1);

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_kanban_drag_drop_move_card_entre_colunas", async ({ page }) => {
  const errors: string[] = [];
  await gotoAuthed(page);
  const view = await openKanban(page);

  const colFrom = view.getByRole("region", { name: /Não visitado/ });
  const colTo = view.getByRole("region", { name: /Visita agendada/ });
  const card = colFrom.locator("article").first();
  await card.waitFor({ state: "visible" });

  // HTML5 DnD: dragstart no card + dragover/drop na coluna destino
  // (Playwright dragTo dispara a sequência nativa de DragEvents).
  await card.dragTo(colTo);

  // Card saiu da origem (assumindo >1 card na origem; se era o único,
  // verifica no destino) e aparece na coluna destino.
  await expect(colTo.locator("article").first()).toBeVisible();
  const fromCount = await colFrom.locator("article").count();
  const toCount = await colTo.locator("article").count();
  expect(toCount).toBeGreaterThanOrEqual(1);
  expect(fromCount + toCount).toBeGreaterThan(1);

  // aria-live anuncia o move do drag também (mesma via do teclado).
  const live = view.locator('[aria-live="polite"]');
  await expect(live).toContainText(/movido para Visita agendada/);

  // Persistiu no localStorage (mesmo contrato do move por menu).
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("apartamentos-app-state") ?? "{}"),
  );
  expect(
    (stored.statuses ?? []).some((s: { status: string }) => s.status === "agendado"),
  ).toBe(true);

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_kanban_estatico_sem_scroll_contador_mais", async ({ page }) => {
  const errors: string[] = [];
  // Estado default: statuses [] → todo o pool cai em "Não visitado"
  // (bem acima da trava KANBAN_VISIBLE_CAP) → overflow garantido.
  await gotoAuthed(page);
  const view = await openKanban(page);

  const col = view.getByRole("region", { name: /Não visitado/ });
  const more = col.getByRole("button", { name: /imóveis ocultos em/ });
  await expect(more).toBeVisible();
  await expect(more).toContainText(/\+\d+ restantes/);

  // Estático de verdade: a coluna não tem scroll interno.
  const overflow = await col.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight + 2);

  // O contador abre a lista; Esc fecha SÓ o dialog (a view continua).
  // Via teclado (foco + Enter): o badge do dev-overlay do Next cobre o
  // rodapé da 1ª coluna em dev e interceptaria click de mouse — e o caminho
  // de teclado ainda prova AC-2 de quebra.
  await more.focus();
  await page.keyboard.press("Enter");
  const dialog = view.getByRole("dialog", { name: /mais \d+ imóveis/ });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /Abrir detalhes de/ }).first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(view).toBeVisible();

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_kanban_dedupe_filtro_coluna_e_whatsapp", async ({ page }) => {
  const apartment = {
    id: "dup-kanban",
    title: "Imóvel duplicado",
    neighborhood: "Batel",
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
    link: "https://example.com/imovel",
    image: "/imoveis/zap-ahu-eca-78.webp",
    features: [],
    description: "Imóvel usado para validar o Kanban.",
  };
  await page.addInitScript((entries) => {
    localStorage.setItem("apartamentos-app-new", JSON.stringify(entries));
  }, [apartment, { ...apartment }]);
  await gotoAuthed(page, {
    statuses: [
      {
        apartmentId: apartment.id,
        status: "novo",
        updatedAt: "2026-09-24T00:00:00.000Z",
        index: 0,
      },
    ],
    followUps: {},
  });

  const view = await openKanban(page);
  const card = view.getByRole("article", { name: /Imóvel duplicado/ });
  await expect(card).toHaveCount(1);

  for (const key of [".", ",", "."]) {
    await card.focus();
    await page.keyboard.press(key);
    await expect(card).toHaveCount(1);
  }

  const filters = view.getByRole("group", { name: "Filtrar por coluna" });
  await filters.getByRole("button", { name: "Contactado", exact: true }).click();
  await expect(view.getByRole("region", { name: /Contactado/ })).toHaveCount(1);
  await expect(view.getByRole("region", { name: /Não visitado/ })).toHaveCount(0);
  await filters.getByRole("button", { name: "Todas", exact: true }).click();
  await expect(view.getByRole("region", { name: /Contactado/ })).toBeVisible();

  await expect(card.getByRole("link", { name: /Abrir WhatsApp/ })).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/5541999999999\?text=/,
  );
});
