import { test, expect } from "@playwright/test";

// Baseline F0′: prova que o ponto de partida está são (login + 7 cards)
// antes de qualquer mudança da leva. Credenciais: env E2E_USER/E2E_PASS
// ou os fallbacks de dev do AppContext (nunca commitar .env.local).
test("test_login_fluxo_dashboard_7cards", async ({ page }) => {
  await page.goto("/");

  await page
    .getByPlaceholder("Digite seu usuário")
    .fill(process.env.E2E_USER ?? "guinness");
  await page
    .getByPlaceholder("Digite sua senha")
    .fill(process.env.E2E_PASS ?? "curitiba2026");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.locator(".card-apartment")).toHaveCount(7);
});
