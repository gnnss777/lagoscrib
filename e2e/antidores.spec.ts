import { test, expect } from "@playwright/test";
import { openApp, signInIfNeeded } from "./open-app";
import { apartmentById, expectedCards } from "./pool-count";

// S004 (AC-ALLIN-01 + AC-WA-01 + AC-CHECK-01 + AC-PLANTA-01): AllInPanel com
// faixas, WhatsApp com as 4 perguntas, checklist persiste/recarrega/copia,
// planta ausente com aviso, regra de ouro visível.
test("test_antidores_allin_whatsapp_checklist_planta", async ({ page }) => {
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
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  await openApp(page);
  await expect(page.locator(".card-apartment")).toHaveCount(expectedCards());

  // O total vem do card, não de literal: a base muda a cada leva e um valor
  // fixo aqui quebrava o teste sem aviso.
  const card = page.locator(".card-apartment").first();
  const cardId = (await card.getAttribute("data-id")) ?? "";
  const imovel = apartmentById(cardId);
  expect(imovel, `id ${cardId} não está na base do perfil ativo`).toBeTruthy();
  const total = (await card.getByTestId("card-total").textContent())?.trim() ?? "";
  expect(total).toMatch(/^R\$/);
  await card.locator("h3").click();

  // AllInPanel: total + faixas de entrada/mudança com o rótulo de estimativa.
  const allin = page.getByTestId("allin-panel");
  await expect(allin).toBeVisible();
  await expect(allin).toContainText(total);
  // Entrada é um múltiplo do total (DEPOSIT_MONTHS), então o texto exato muda
  // com a base. O que não muda é o formato: faixa "R$ … – R$ …". \s porque o
  // Intl pt-BR usa espaço não separável depois do "R$".
  await expect(page.getByTestId("entry-estimate")).toHaveText(
    /^R\$\s[\d.]+\s–\sR\$\s[\d.]+$/,
  );
  // Mesma regra da entrada: a mudança também deriva do total, então o literal
  // fixo aqui quebrava a cada leva sem que nada do produto mudasse.
  await expect(page.getByTestId("moving-estimate")).toHaveText(
    /^R\$\s[\d.]+\s–\sR\$\s[\d.]+$/,
  );
  await expect(allin).toContainText("estimativa — confirmar com a imobiliária");

  // Verificação + regra de ouro + WhatsApp com as 4 perguntas.
  // A fonte do selo vem do IMÓVEL (o mesmo id que o card mostrou), não de um
  // literal de portal: a ordenação default é por `verifiedAt`, e o 1º card já
  // mudou de "Zap Imóveis" para "Chaves na Mão" quando a leva 6 entrou — o
  // literal "Zap Imóveis" quebrou sem que nada do produto mudasse.
  await expect(page.getByTestId("verified-badge")).toContainText(imovel!.source!);
  await expect(page.getByTestId("golden-rule")).toHaveText(
    "Não pague nada antes de visitar o imóvel pessoalmente"
  );
  const waHref =
    (await page.getByTestId("confirm-button").getAttribute("href")) ?? "";
  // Com telefone no data.ts o deep link leva o número (wa.me/<phone>?text=…,
  // ADR-004); sem telefone continua wa.me/?text=…
  expect(waHref).toMatch(/^https:\/\/wa\.me\/(?:\d{10,14}\?text=|\?text=)/);
  const waDecoded = decodeURIComponent(waHref);
  expect(waDecoded).toContain("disponível");
  expect(waDecoded).toMatch(/condomínio/i);
  expect(waDecoded).toMatch(/pet/i);
  expect(waDecoded).toMatch(/fiador/i);

  // Clicar no TELEFONE do card abre o WhatsApp com a mesma mensagem — não é
  // mais um link tel:. Pega o primeiro card com telefone da base.
  const phoneCard = page
    .locator(".card-apartment")
    .filter({ has: page.getByRole("link", { name: /Conversar no WhatsApp sobre/ }) })
    .first();
  await expect(phoneCard).toBeVisible();
  const cardWaHref =
    (await phoneCard.getByRole("link", { name: /Conversar no WhatsApp sobre/ }).getAttribute("href")) ?? "";
  expect(cardWaHref).toMatch(/^https:\/\/wa\.me\/\d{10,14}\?text=/);
  expect(cardWaHref).not.toContain("tel:");
  const cardMsg = decodeURIComponent(cardWaHref);
  expect(cardMsg).toMatch(/visita AMANHÃ/i);
  expect(cardMsg).toMatch(/taxa de conservação/i);
  expect(cardMsg).toMatch(/IPTU/i);
  expect(cardMsg).toMatch(/incentivo/i);
  // O link `tel:` de ligar ficou só no DetailModal, que tem os dois.
  await expect(phoneCard.locator('a[href^="tel:"]')).toHaveCount(0);

  // Checklist: marca → copia com feedback → persiste após reload.
  await page.getByRole("button", { name: "Checklist" }).click();
  const checklist = page.getByTestId("checklist");
  await expect(checklist).toBeVisible();
  await checklist.getByRole("checkbox", { name: "Pressão da água e aquecedor" }).check();
  await page.getByRole("button", { name: "Copiar" }).click();
  // Escopo o status: a página tem mais de um (o modo de visualização também
  // anuncia, em role="status").
  await expect(page.getByRole("status").filter({ hasText: "Checklist copiado" })).toHaveText(
    "Checklist copiado!",
  );
  await page.reload();
  await signInIfNeeded(page);
  await expect(page.locator(".card-apartment")).toHaveCount(expectedCards());
  await page.locator(".card-apartment").first().locator("h3").click();
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
