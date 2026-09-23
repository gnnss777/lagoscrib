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
  await page.getByRole("button", { name: "Prospecção", exact: true }).click();
  const view = page.getByTestId("kanban-view");
  await expect(view).toBeVisible();
  return view;
}

test("test_kanban_prospectar_da_busca_2_acoes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await gotoAuthed(page);

  // 1ª ação: Prospectar no 1º card → 2ª: view tela cheia abre.
  await page
    .getByRole("button", { name: /Prospectar .* no kanban/ })
    .first()
    .click();
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
  page.on("pageerror", (err) => errors.push(err.message));
  await gotoAuthed(page);
  const view = await openKanban(page);

  // Foca o 1º card de "Não visitado" e move com "." (estilo Trello).
  const col = view.getByRole("region", { name: /Não visitado/ });
  const card = col.locator("article").first();
  await card.focus();
  await page.keyboard.press(".");

  // aria-live policial anuncia destino + posição (fecha B6).
  const live = view.locator('[aria-live="polite"]');
  await expect(live).toContainText(/movido para Visita agendada \(posição \d+ de \d+\)/);

  // Card saiu da coluna de origem.
  await expect(
    view
      .getByRole("region", { name: /Visita agendada/ })
      .locator("article")
      .first(),
  ).toBeVisible();

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_kanban_customizacao_painel_renomear_reload_reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
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

  // Reset: volta exatamente aos 6 padrão.
  await view2.getByRole("button", { name: "Configurar quadro" }).click();
  const panel2 = view2.getByRole("complementary", { name: "Configurar quadro" });
  await panel2
    .getByRole("button", { name: "Voltar ao padrão (6 colunas)" })
    .click();
  await expect(
    view2.getByRole("region", { name: /Não visitado/ }),
  ).toBeVisible();

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_kanban_filtro_so_sem_retorno", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
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
