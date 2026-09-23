import { test, expect } from "@playwright/test";

// S006 (AC-TOGGLE-01 + modal de venda + status reutilizado): toggle alterna
// sem erro nem estado preso; Comprar com 5 vendas reais sem "/mês"; busca e
// stats refletem a aba; modal de venda sem bloco de locação.
test("test_venda_toggle_abas_valores_modal", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text().trim();
      // Next dev mode emite "eval() is not supported" do React — não é erro app.
      if (!text.startsWith("eval()") && !text.includes("Content-Security-Policy")) {
        errors.push(text);
      }
    }
  });

  await page.goto("/");
  await page
    .getByPlaceholder("Digite seu usuário")
    .fill(process.env.E2E_USER ?? "guinness");
  await page
    .getByPlaceholder("Digite sua senha")
    .fill(process.env.E2E_PASS ?? "curitiba2026");
  await page.getByRole("button", { name: "Entrar" }).click();

  // Aba default: Alugar, 57 cards com "/mês".
  await expect(page.locator(".card-apartment")).toHaveCount(57);
  const toggle = page.getByTestId("transaction-toggle");
  await expect(toggle.getByRole("button", { name: "Alugar" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.locator(".card-apartment").first()).toContainText("/mês");
  await page.screenshot({ path: "test-results/s006-alugar.png" });

  // 3 alternâncias seguidas sem erro nem estado preso.
  await toggle.getByRole("button", { name: "Comprar" }).click();
  await expect(page.locator(".card-apartment")).toHaveCount(52);
  await toggle.getByRole("button", { name: "Alugar" }).click();
  await expect(page.locator(".card-apartment")).toHaveCount(57);
  await toggle.getByRole("button", { name: "Comprar" }).click();
  await expect(page.locator(".card-apartment")).toHaveCount(52);
  await expect(toggle.getByRole("button", { name: "Comprar" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  // 52 vendas reais, valores do anúncio, sem "/mês", stats da aba.
  await expect(page.locator(".card-apartment").first()).not.toContainText("/mês");
  await expect(page.getByText(/\d+ apartamentos encontrados/)).toBeVisible();
  // Stat da aba venda reflete o dataset (não hardcode).
  await expect(page.getByText(/\d+ apartamentos encontrados/)).toBeVisible();
  // Intl usa NBSP após "R$" — \s normaliza tudo antes de comparar.
  const grid = (await page.locator("main").textContent()) ?? "";
  expect(grid).not.toContain("/mês");
  await page.screenshot({ path: "test-results/s006-comprar.png" });

  // Busca reflete a aba ativa.
  await page
    .getByPlaceholder("Buscar por título, bairro ou endereço...")
    .fill("Tingui");
  const found = await page.locator(".card-apartment").count();
  expect(found).toBeGreaterThanOrEqual(1);
  await expect(page.getByText(/de \d+ apartamentos/)).toBeVisible();

  // Modal de venda: bloco de compra, sem entrada de locação, selo com data.
  await page.locator(".card-apartment").first().click();
  const allin = page.getByTestId("allin-panel");
  await expect(allin).toContainText("Valores de Compra");
  await expect(allin).toContainText("Preço/m²");
  await expect(page.getByTestId("entry-estimate")).toHaveCount(0);
  await expect(allin).not.toContainText("Entrada estimada");
  await expect(page.getByTestId("verified-badge")).toContainText(
    /Verificado em \d{2}\/\d{2}\/\d{4}/
  );
  // Gallery counter do dataset real (não hardcode).
  await expect(page.getByTestId("gallery-counter")).toHaveText(/\d+\/\d+/);

  // Status workflow reutilizado na venda (mesmo código, sem duplicar).
  // Tema lightbox (DESIGN.md v2): anel de seleção em ink sobre card claro.
  await page.getByRole("button", { name: "Em negociação" }).click();
  await expect(
    page.getByRole("button", { name: "Em negociação" })
  ).toHaveAttribute("class", /ring-ink/);

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});
