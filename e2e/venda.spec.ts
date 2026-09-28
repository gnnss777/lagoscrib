import { test, expect } from "@playwright/test";

// Toggle Alugar | Comprar. A leva 4 (27/09/2026) é só de aluguel — a coleta
// foi dirigida para 2-3 quartos até R$ 3.000, então `saleApartments` está
// vazio por decisão (lib/data.ts). O que este teste trava hoje é o
// comportamento com pool vazio: alternar não gruda, a aba mostra o estado
// vazio e nada quebra. As asserções de venda (preço/m², bloco "Valores de
// Compra", busca em imóveis de venda) voltam quando a base tiver vendas.
test("test_venda_toggle_abas_com_pool_de_venda_vazio", async ({ page }) => {
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

  // Aba default: Alugar, com a base inteira e "/mês" no card.
  await expect(page.locator(".card-apartment")).toHaveCount(80);
  const toggle = page.getByTestId("transaction-toggle");
  await expect(toggle.getByRole("button", { name: "Alugar" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".card-apartment").first()).toContainText("/mês");
  await page.screenshot({ path: "test-results/s006-alugar.png" });

  // 3 alternâncias seguidas sem erro nem estado preso.
  await toggle.getByRole("button", { name: "Comprar" }).click();
  await expect(page.locator(".card-apartment")).toHaveCount(0);
  await toggle.getByRole("button", { name: "Alugar" }).click();
  await expect(page.locator(".card-apartment")).toHaveCount(80);
  await toggle.getByRole("button", { name: "Comprar" }).click();
  await expect(page.locator(".card-apartment")).toHaveCount(0);
  await expect(toggle.getByRole("button", { name: "Comprar" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Estado vazio honesto: mensagem de "nada encontrado", sem card e sem modal.
  await expect(page.getByText("Nenhum apartamento encontrado")).toBeVisible();
  await expect(page.getByText(/0 apartamentos encontrados/)).toBeVisible();
  await page.screenshot({ path: "test-results/s006-comprar.png" });

  // Voltar para Alugar restaura a base inteira.
  await toggle.getByRole("button", { name: "Alugar" }).click();
  await expect(page.locator(".card-apartment")).toHaveCount(80);
  await expect(page.locator(".card-apartment").first()).toContainText("/mês");

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});
