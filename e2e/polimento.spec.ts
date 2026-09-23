import { test, expect, type Page } from "@playwright/test";

// Polimento UX v2 (F1): card mínimo, stagger com cap e foco/Esc com
// restauração do gatilho. Estado semeado via localStorage.

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

test("test_polimento_card_minimo_sem_links_comparar_isolado", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await gotoAuthed(page);

  const card = page.locator(".card-apartment").first();

  // F3.1: card mínimo — sem links e sem Prospectar (vive no DetailModal).
  await expect(card.locator("a")).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: /Prospectar/ }),
  ).toHaveCount(0);

  // Comparar existe e é isolado do clique do card (F1.1 stopPropagation).
  const compare = card.getByRole("checkbox", { name: /Comparar/ });
  await expect(compare).toBeVisible();
  await compare.click();
  await expect(
    page.getByRole("dialog", { name: /Detalhes de/ }),
  ).toHaveCount(0);

  // Clicar no card abre o DetailModal com dialog a11y (F1.2).
  await card.click();
  const dialog = page.getByRole("dialog", { name: /Detalhes de/ });
  await expect(dialog).toBeVisible();

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_polimento_stagger_converge_sem_fila", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await gotoAuthed(page);

  // F1.3: com cap (12 × 0.08 + 0.5s), os 21 primeiros cards convergem
  // (opacidade 1) em bem menos de 4s. O teto exato mora no unit
  // motion.test.ts (determinístico); aqui vale o resultado funcional.
  const cards = page.locator(".card-apartment");
  const n = await cards.count();
  expect(n).toBeGreaterThan(12);
  const upto = Math.min(n, 21);
  for (let i = 0; i < upto; i++) {
    await expect(cards.nth(i)).toHaveCSS("opacity", "1", { timeout: 4000 });
  }

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_polimento_kanban_foco_esc_restaura_gatilho", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await gotoAuthed(page);

  // F1.4: abrir leva o foco p/ dentro da view (não é dialog).
  const pill = page.getByRole("button", {
    name: "Abrir prospecção (kanban)",
  });
  await pill.click();
  const view = page.getByTestId("kanban-view");
  await expect(view).toBeVisible();
  await expect
    .poll(
      async () =>
        await view.evaluate((el) =>
          el.contains(document.activeElement) ? "inside" : "outside",
        ),
    )
    .toBe("inside");

  // Esc fecha e devolve o foco ao gatilho (pill Prospecção).
  await page.keyboard.press("Escape");
  await expect(view).toHaveCount(0);
  await expect
    .poll(async () => await pill.evaluate((el) => el === document.activeElement ? "focused" : "blurred"))
    .toBe("focused");

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});
