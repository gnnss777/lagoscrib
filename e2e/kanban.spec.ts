import { test, expect, type Page } from "@playwright/test";

// Kanban de prospecção (leva kanban-prospeccao): board, mover por teclado,
// prospectar da busca, customização de colunas e filtro sem-retorno.
// Estado semeado via localStorage (mesmo padrão do persistencia.spec.ts).

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

async function openProfile(page: Page) {
  await page.getByRole("button", { name: /Olá, guinness/ }).click();
  await expect(
    page.getByRole("dialog", { name: /Perfil de guinness/ }),
  ).toBeVisible();
}

test("test_kanban_prospectar_da_busca_2_acoes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await gotoAuthed(page);

  // 1ª ação: Prospectar no 1º card → 2ª: Perfil abre já na Prospecção.
  await page
    .getByRole("button", { name: /Prospectar .* no kanban/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: /Perfil de guinness/ });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("tab", { name: "Prospecção", selected: true }),
  ).toBeVisible();
  await expect(dialog.getByText("Não visitado").first()).toBeVisible();

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_kanban_teclado_move_menu_anuncia_aria_live", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await gotoAuthed(page);
  await openProfile(page);
  const dialog = page.getByRole("dialog", { name: /Perfil de guinness/ });

  // Foca o 1º card de "Não visitado" e move com "." (estilo Trello).
  const col = dialog.getByRole("region", { name: /Não visitado/ });
  const card = col.locator("article").first();
  await card.focus();
  await page.keyboard.press(".");

  // aria-live policial anuncia destino + posição (fecha B6).
  const live = dialog.locator('[aria-live="polite"]');
  await expect(live).toContainText(/movido para Visita agendada \(posição \d+ de \d+\)/);

  // Card saiu da coluna de origem.
  await expect(
    dialog
      .getByRole("region", { name: /Visita agendada/ })
      .locator("article")
      .first(),
  ).toBeVisible();

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_kanban_customizacao_colunas_renomear_reordenar_reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await gotoAuthed(page);
  await openProfile(page);
  const dialog = page.getByRole("dialog", { name: /Perfil de guinness/ });

  // Aba de configuração: renomeia "Não visitado" → "Quero visitar".
  await dialog.getByRole("tab", { name: "Configurar quadro" }).click();
  const input = dialog.getByRole("textbox", { name: "Nome da coluna Não visitado" });
  await input.fill("Quero visitar");
  await input.press("Enter");

  // Volta à Prospecção: coluna renomeada aparece.
  await dialog.getByRole("tab", { name: "Prospecção" }).click();
  await expect(
    dialog.getByRole("region", { name: /Quero visitar/ }),
  ).toBeVisible();

  // Reload: customização sobrevive (AC-9).
  await page.reload();
  await expect(page.locator(".card-apartment").first()).toBeVisible();
  await openProfile(page);
  const dialog2 = page.getByRole("dialog", { name: /Perfil de guinness/ });
  await expect(
    dialog2.getByRole("region", { name: /Quero visitar/ }),
  ).toBeVisible();

  // Reset: volta exatamente aos 6 padrão.
  await dialog2.getByRole("tab", { name: "Configurar quadro" }).click();
  await dialog2
    .getByRole("button", { name: "Voltar ao padrão (6 colunas)" })
    .click();
  await dialog2.getByRole("tab", { name: "Prospecção" }).click();
  await expect(
    dialog2.getByRole("region", { name: /Não visitado/ }),
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
  await openProfile(page);
  const dialog = page.getByRole("dialog", { name: /Perfil de guinness/ });

  // Selo visível em ≤1 olhar (AC-3) + alerta na coluna.
  await expect(dialog.getByText("sem retorno ×2").first()).toBeVisible();
  await expect(dialog.getByText(/sem retorno há 7\+ dias/).first()).toBeVisible();

  // Filtro: só o pendente aparece.
  await dialog.getByRole("button", { name: /Só sem retorno/ }).click();
  await expect(dialog.locator("article")).toHaveCount(1);

  // Mostrar todos: volta tudo.
  await dialog.getByRole("button", { name: /Mostrar todos/ }).click();
  expect(await dialog.locator("article").count()).toBeGreaterThan(1);

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});
