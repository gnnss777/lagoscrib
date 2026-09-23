import { test, expect, type Page } from "@playwright/test";

// Slider duplo de preço (leva kanban-tela-inteira-ui, AC-U4/U6): thumbs por
// teclado, aria-valuetext em BRL, chips ao vivo e efeito real no filtro.
// Linear no aluguel (0–20k), log na venda (0–35M).

async function gotoAuthed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "apartamentos-app-state",
      JSON.stringify({
        isAuthenticated: true,
        username: "guinness",
        notes: [],
        statuses: [],
      }),
    );
  });
  await page.goto("/");
  await expect(page.locator(".card-apartment").first()).toBeVisible();
}

async function openFilters(page: Page) {
  await page.getByTestId("filter-toggle").click();
  await expect(page.getByTestId("filter-panel")).toBeVisible();
}

test("test_slider_teclado_valvetext_filtra_restaura", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await gotoAuthed(page);
  const initial = await page.locator(".card-apartment").count();
  expect(initial).toBeGreaterThan(1);
  await openFilters(page);

  const panel = page.getByTestId("filter-panel");
  const min = panel.getByRole("slider", { name: "Preço mínimo" });
  const max = panel.getByRole("slider", { name: "Preço máximo" });

  // Estado inicial: "tanto faz" nos dois.
  await expect(min).toHaveAttribute("aria-valuetext", "Sem mínimo");
  await expect(max).toHaveAttribute("aria-valuetext", "Sem máximo");

  // End no mínimo → R$ 20.000: nada passa (maior aluguel < 20k).
  await min.focus();
  await page.keyboard.press("End");
  await expect(min).toHaveAttribute("aria-valuetext", /R\$\s20\.000/);
  await expect(panel.getByText(/R\$\s20\.000/).first()).toBeVisible();
  await expect(page.locator(".card-apartment")).toHaveCount(0);

  // Home restaura: volta tudo.
  await page.keyboard.press("Home");
  await expect(min).toHaveAttribute("aria-valuetext", "Sem mínimo");
  await expect(page.locator(".card-apartment")).toHaveCount(initial);

  // Home no máximo → R$ 0: nada passa; End restaura.
  await max.focus();
  await page.keyboard.press("Home");
  await expect(max).toHaveAttribute("aria-valuetext", /R\$\s0/);
  await expect(page.locator(".card-apartment")).toHaveCount(0);
  await page.keyboard.press("End");
  await expect(max).toHaveAttribute("aria-valuetext", "Sem máximo");
  await expect(page.locator(".card-apartment")).toHaveCount(initial);

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_slider_aba_comprar_escala_log_valvetext", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await gotoAuthed(page);
  await openFilters(page);

  // Troca p/ Comprar: posições recalculam na escala log.
  await page.getByRole("button", { name: "Comprar" }).click();
  const panel = page.getByTestId("filter-panel");
  const min = panel.getByRole("slider", { name: "Preço mínimo" });
  await expect(min).toHaveAttribute("aria-valuetext", "Sem mínimo");

  // End → teto de R$ 35M (log); nada passa; Home restaura.
  await min.focus();
  await page.keyboard.press("End");
  await expect(min).toHaveAttribute("aria-valuetext", /R\$\s35\.000\.000/);
  await expect(page.locator(".card-apartment")).toHaveCount(0);
  await page.keyboard.press("Home");
  await expect(min).toHaveAttribute("aria-valuetext", "Sem mínimo");
  expect(await page.locator(".card-apartment").count()).toBeGreaterThan(1);

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});
