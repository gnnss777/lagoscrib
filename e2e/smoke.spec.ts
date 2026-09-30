import { test, expect } from "@playwright/test";
import { openApp } from "./open-app";
import { expectedCards } from "./pool-count";

// Baseline F0′: prova que o ponto de partida está são antes de qualquer
// mudança da leva. O app está em open access (NEXT_PUBLIC_OPEN_ACCESS), então
// chega no Dashboard sem passar por login; se o gate voltar, openApp() loga
// (env E2E_USER/E2E_PASS ou os fallbacks de dev do AppContext — nunca
// commitar .env.local).
//
// O número esperado é DERIVADO do pool do perfil ativo (e2e/pool-count.ts), não
// literal: o que este teste prova é "todos os cards do pool renderizaram", e
// isso continua valendo quando a próxima leva troca 152 por 178. O `89` fixo
// que estava aqui quebrou sozinho na leva que populou a base.
test("test_open_app_chega_no_dashboard_ncards", async ({ page }) => {
  await openApp(page);

  await expect(page.locator(".card-apartment")).toHaveCount(expectedCards());
});
