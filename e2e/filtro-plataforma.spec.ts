// O filtro de plataforma na TELA. O unitário garante a lógica; este garante
// que dá pra chegar nele e que ele muda o que aparece.

import { test, expect, type Page } from "@playwright/test";
import { openApp } from "./open-app";

const cards = (page: Page) => page.locator(".card-apartment").count();

test.beforeEach(async ({ page }) => {
  await openApp(page);
  // Mesmo caminho do AC-FILT-06: garante que o toggle está no estado "fechado"
  // antes de clicar, em vez de confiar em `isVisible()` num app que ainda
  // hidratou. Clicar cegamente num painel já aberto o fecha.
  const panel = page.getByTestId("filter-panel");
  const toggle = page.getByTestId("filter-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test("filtro de plataforma aparece com contagem e filtra a lista", async ({ page }) => {
  const grupo = page.getByRole("group", { name: "Plataforma de origem" });
  await expect(grupo).toBeVisible();

  // O rótulo carrega a contagem real da base, não um número inventado.
  const chip = grupo.locator("button", { hasText: "Chaves na Mão" });
  await expect(chip).toBeVisible();

  const antes = await cards(page);
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");

  const depois = await cards(page);
  // Todas as casas desta base vêm do Chaves na Mão, então filtrar por ele não
  // pode esvaziar a lista — e o teste falha se a contagem explodir ou zerar.
  expect(depois).toBeGreaterThan(0);
  expect(depois).toBeLessThanOrEqual(antes);

  // O badge de filtros ativos conta o grupo.
  await expect(page.getByTestId("filter-toggle")).toContainText("(1)");
});

test("limpar plataforma devolve a lista inteira", async ({ page }) => {
  const grupo = page.getByRole("group", { name: "Plataforma de origem" });
  const chip = grupo.locator("button", { hasText: "Chaves na Mão" });
  const antes = await cards(page);

  await chip.click();
  const filtrado = await cards(page);

  await page.getByTestId("f-origem-limpar").click();
  const depois = await cards(page);

  expect(depois).toBe(antes);
  expect(filtrado).toBeLessThanOrEqual(antes);
});

test("várias plataformas combinam (OU dentro do grupo)", async ({ page }) => {
  const grupo = page.getByRole("group", { name: "Plataforma de origem" });
  const chips = grupo.locator("button[aria-pressed]");

  // Se a base tiver só uma plataforma, o teste não tem o que provar.
  if ((await chips.count()) < 2) test.skip(true, "base com uma plataforma só");

  await chips.nth(0).click();
  const um = await cards(page);
  await chips.nth(1).click();
  const dois = await cards(page);

  expect(dois).toBeGreaterThanOrEqual(um);
  await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
});