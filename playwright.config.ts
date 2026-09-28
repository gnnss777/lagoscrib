import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Serial: 4 workers contra 1 `next dev` causavam flakes de timeout de
  // imagem na galeria (S005/S006) — carga, não bug. ~30s, determinístico.
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  // O primeiro spec da suíte paga a compilação a frio do chunk do dashboard
  // (`next dev` compila sob demanda, e o chunk só é baixado depois do login).
  // Com o padrão de 5s a 1ª assertion de contagem de cards estourava e o resto
  // da suíte passava — calorizado. 20s cobre a compilação sem mascarar bug:
  // um elemento que nunca aparece ainda falha.
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
