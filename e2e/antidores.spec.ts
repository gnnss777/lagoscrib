import { test, expect } from "@playwright/test";

// S004 (AC-ALLIN-01 + AC-WA-01 + AC-CHECK-01 + AC-PLANTA-01): AllInPanel com
// faixas, WhatsApp com as 4 perguntas, checklist persiste/recarrega/copia,
// planta ausente com aviso, regra de ouro visível.
test("test_antidores_allin_whatsapp_checklist_planta", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/");
  await page
    .getByPlaceholder("Digite seu usuário")
    .fill(process.env.E2E_USER ?? "guinness");
  await page
    .getByPlaceholder("Digite sua senha")
    .fill(process.env.E2E_PASS ?? "curitiba2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator(".card-apartment")).toHaveCount(7);

  // Primeiro imóvel: Água Verde Castro 123 (condomínio a confirmar, total 2350).
  await page.locator(".card-apartment").first().click();

  // AllInPanel: total + faixas de entrada/mudança com o rótulo de estimativa.
  const allin = page.getByTestId("allin-panel");
  await expect(allin).toBeVisible();
  await expect(allin).toContainText("R$ 2.350");
  await expect(page.getByTestId("entry-estimate")).toHaveText(
    "R$ 2.350 – R$ 9.400"
  );
  await expect(page.getByTestId("moving-estimate")).toHaveText(
    "R$ 1.000 – R$ 1.800"
  );
  await expect(allin).toContainText("estimativa — confirmar com a imobiliária");

  // Verificação + regra de ouro + WhatsApp com as 4 perguntas.
  await expect(page.getByTestId("verified-badge")).toContainText(
    "Fonte: Zap Imóveis"
  );
  await expect(page.getByTestId("golden-rule")).toHaveText(
    "Não pague nada antes de visitar o imóvel pessoalmente"
  );
  const waHref =
    (await page.getByTestId("confirm-button").getAttribute("href")) ?? "";
  expect(waHref).toContain("https://wa.me/?text=");
  const waDecoded = decodeURIComponent(waHref);
  expect(waDecoded).toContain("disponível");
  expect(waDecoded).toMatch(/condomínio/i);
  expect(waDecoded).toMatch(/pet/i);
  expect(waDecoded).toMatch(/fiador/i);

  // Checklist: marca → copia com feedback → persiste após reload.
  await page.getByRole("button", { name: "Checklist" }).click();
  const checklist = page.getByTestId("checklist");
  await expect(checklist).toBeVisible();
  await checklist.getByRole("checkbox", { name: "Pressão da água e aquecedor" }).check();
  await page.getByRole("button", { name: "Copiar" }).click();
  await expect(page.getByRole("status")).toHaveText("Checklist copiado!");
  await page.reload();
  await expect(page.locator(".card-apartment")).toHaveCount(7);
  await page.locator(".card-apartment").first().click();
  await page.getByRole("button", { name: "Checklist" }).click();
  await expect(
    page
      .getByTestId("checklist")
      .getByRole("checkbox", { name: "Pressão da água e aquecedor" })
  ).toBeChecked();

  // Planta: nenhum anúncio divulga → aviso, nunca imagem quebrada.
  await page.getByRole("button", { name: "Planta", exact: true }).click();
  const floorplan = page.getByTestId("floorplan");
  await expect(floorplan).toContainText("Planta não divulgada no anúncio");
  expect(await floorplan.locator("img").count()).toBe(0);

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});
