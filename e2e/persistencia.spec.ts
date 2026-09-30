import { test, expect } from "@playwright/test";
import { signInIfNeeded } from "./open-app";
import { expectedCards } from "./pool-count";

// S004 (ADR-002 decisão 2): estado v1 (sem version/checklist) continua legível
// após o schema versionado v2 — notas/status antigos sobrevivem, checklist novo
// persiste lado a lado.
test("test_persistencia_estado_v1_sobrevive_v2", async ({ page }) => {
  const errors: string[] = [];

  // Semeia o estado v1 direto (sem `version`). O guard é essencial: este script
  // roda a CADA navegação, e sem ele o reload apagaria a nota que o teste
  // acabou de semear.
  //
  // O `isAuthenticated: true` do seeding NÃO autentica (lib/AppContext.tsx
  // ignora o flag vindo do storage, por decisão de segurança) — quem entra é o
  // form, via signInIfNeeded. Sem esse passo o teste morria no gate de login
  // com 0 cards, e a linha seguinte "vendo 89 em vez de 0" escondia a causa.
  await page.addInitScript(() => {
    const chave = "apartamentos-app-state";
    if (localStorage.getItem(chave)) return;
    localStorage.setItem(
      chave,
      JSON.stringify({
        isAuthenticated: true,
        username: "guinness",
        notes: [],
        statuses: [],
      })
    );
  });

  await page.goto("/");
  await signInIfNeeded(page);
  await expect(page.locator(".card-apartment")).toHaveCount(expectedCards());

  // O id do primeiro card vem da própria base (muda a cada leva). Semear nota
  // e status nele e recarregar é o que prova a migração v1 -> v2.
  const alvo = await page
    .locator(".card-apartment")
    .first()
    .getAttribute("data-id");
  expect(alvo).toBeTruthy();
  await page.evaluate((id) => {
    const chave = "apartamentos-app-state";
    const atual = JSON.parse(localStorage.getItem(chave) ?? "{}");
    localStorage.setItem(
      chave,
      JSON.stringify({
        ...atual,
        notes: [
          {
            id: "note-v1-antiga",
            apartmentId: id,
            text: "Nota antiga v1 — deve sobreviver",
            createdAt: "2026-09-20T10:00:00.000Z",
          },
        ],
        statuses: [
          {
            apartmentId: id,
            status: "agendado",
            updatedAt: "2026-09-20T10:00:00.000Z",
          },
        ],
      })
    );
  }, alvo!);
  await page.reload();
  await signInIfNeeded(page);
  await expect(page.locator(".card-apartment")).toHaveCount(expectedCards());

  await page.locator(".card-apartment").first().locator("h3").click();

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
  await signInIfNeeded(page);
  await expect(page.locator(".card-apartment")).toHaveCount(expectedCards());
  await page.locator(".card-apartment").first().locator("h3").click();
  await page.getByRole("button", { name: /Notas \(1\)/ }).click();
  await expect(page.locator("text=Nota antiga v1 — deve sobreviver")).toBeVisible();

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});