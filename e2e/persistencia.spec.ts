import { test, expect } from "@playwright/test";

// S004 (ADR-002 decisão 2): estado v1 (sem version/checklist) continua legível
// após o schema versionado v2 — notas/status antigos sobrevivem, checklist novo
// persiste lado a lado.
test("test_persistencia_estado_v1_sobrevive_v2", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  // Semeia um estado v1 real: autenticado + 1 nota + 1 status, sem version.
  await page.addInitScript(() => {
    localStorage.setItem(
      "apartamentos-app-state",
      JSON.stringify({
        isAuthenticated: true,
        username: "guinness",
        notes: [
          {
            id: "note-v1-antiga",
            apartmentId: "zap-aguaverde-castro-123",
            text: "Nota antiga v1 — deve sobreviver",
            createdAt: "2026-09-20T10:00:00.000Z",
          },
        ],
        statuses: [
          {
            apartmentId: "zap-aguaverde-castro-123",
            status: "agendado",
            updatedAt: "2026-09-20T10:00:00.000Z",
          },
        ],
      })
    );
  });

  // Já autenticado: dashboard direto, sem login.
  await page.goto("/");
  await expect(page.locator(".card-apartment")).toHaveCount(7);

  await page.locator(".card-apartment").first().click();

  // Nota v1 visível na aba Notas.
  await page.getByRole("button", { name: /Notas \(1\)/ }).click();
  await expect(page.getByTestId("gallery")).toBeVisible();
  await expect(page.locator("text=Nota antiga v1 — deve sobreviver")).toBeVisible();

  // Status v1 respeitado (volta a Detalhes: "Visita agendada" ativo).
  // exact: sem ele, "Detalhes" casa por substring o "Fechar detalhes (Esc)".
  await page.getByRole("button", { name: "Detalhes", exact: true }).click();
  const agendado = page.getByRole("button", { name: "Visita agendada" });
  // Tema lightbox (DESIGN.md v2): anel de seleção em ink sobre card claro.
  await expect(agendado).toHaveAttribute("class", /ring-ink/);

  // Checklist v2 funciona sobre o estado v1 e persiste após reload.
  await page.getByRole("button", { name: "Checklist" }).click();
  await page
    .getByTestId("checklist")
    .getByRole("checkbox", { name: "Tomadas e interruptores" })
    .check();
  await page.reload();
  await expect(page.locator(".card-apartment")).toHaveCount(7);
  await page.locator(".card-apartment").first().click();
  await page.getByRole("button", { name: /Notas \(1\)/ }).click();
  await expect(page.locator("text=Nota antiga v1 — deve sobreviver")).toBeVisible();

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});
