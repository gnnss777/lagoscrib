import { test, expect, type Page } from "@playwright/test";

// S010 (F3): form completo — imóvel novo com 4/2/2 entra nos filtros
// numéricos; banheiros 3+ o exclui. Zero erro de console.
async function login(page: Page) {
  await page.goto("/");
  await page
    .getByPlaceholder("Digite seu usuário")
    .fill(process.env.E2E_USER ?? "guinness");
  await page
    .getByPlaceholder("Digite sua senha")
    .fill(process.env.E2E_PASS ?? "curitiba2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator(".card-apartment")).toHaveCount(7);
}

test("test_form_novo_filtravel_quartos_elevador_banheiros", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await login(page);

  await page.getByRole("button", { name: "Adicionar Novo Imóvel" }).click();
  await page.getByPlaceholder("Título", { exact: true }).fill("Ap 4Q Teste");
  await page.getByPlaceholder("Bairro", { exact: true }).fill("BairroFormE2E");
  await page
    .getByPlaceholder("Link do anúncio (OLX/VivaReal)")
    .fill("https://exemplo.com/e2e-form");
  await page.getByPlaceholder("Quartos").fill("4");
  await page.getByPlaceholder("Banheiros").fill("2");
  await page.getByPlaceholder("Vagas").fill("2");
  // Elevador já vem marcado por padrão — garante explicitamente.
  const chip = page.getByRole("button", { name: "Elevador", exact: true });
  if ((await chip.getAttribute("aria-pressed")) !== "true") {
    await chip.click();
  }
  await page.screenshot({ path: "test-results/s010-form.png" });
  await page.getByRole("button", { name: "Importar Novo Imóvel" }).click();
  await page.reload();
  await expect(page.locator(".card-apartment")).toHaveCount(8);

  // Quartos 3+ + Elevador inclui o novo (Comendador + novo).
  await page.getByTestId("filter-toggle").click();
  await page.locator("#f-quartos").selectOption("3");
  await page.getByRole("button", { name: /Elevador · \d+/ }).click();
  await expect(page.locator(".card-apartment")).toHaveCount(2);
  await expect(page.getByText("2 de 8 apartamentos")).toBeVisible();
  await expect(page.locator(".card-apartment").first()).toBeVisible();
  await expect(
    page.getByText("Ap 4Q Teste", { exact: true })
  ).toBeVisible();

  // Banheiros 3+ exclui o novo (tem 2) — some do grid.
  await page.locator("#f-banheiros").selectOption("3");
  await expect(
    page.getByText("Ap 4Q Teste", { exact: true })
  ).toHaveCount(0);

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});
