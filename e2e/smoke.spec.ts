import { test, expect } from "@playwright/test";
import { openApp } from "./open-app";

// Baseline F0′: prova que o ponto de partida está são antes de qualquer
// mudança da leva. O app está em open access (NEXT_PUBLIC_OPEN_ACCESS), então
// chega no Dashboard sem passar por login; se o gate voltar, openApp() loga
// (env E2E_USER/E2E_PASS ou os fallbacks de dev do AppContext — nunca
// commitar .env.local).
test("test_open_app_chega_no_dashboard_ncards", async ({ page }) => {
  await openApp(page);

  await expect(page.locator(".card-apartment")).toHaveCount(89);
});
