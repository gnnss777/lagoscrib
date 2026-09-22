import { test, expect } from "@playwright/test";

// S005 (AC-COMP-01): 3 selecionados → tabela com totais e links; 5º bloqueado
// com aviso; ordem default por custo total efetivo; zero erro de console.
test("test_comparacao_tabela_ordem_bloqueio_links", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/");
  await page
    .getByPlaceholder("Digite seu usuário")
    .fill(process.env.E2E_USER ?? "guinness");
  await page
    .getByPlaceholder("Digite sua senha")
    .fill(process.env.E2E_PASS ?? "curitiba2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator(".card-apartment")).toHaveCount(7);

  const compareBoxes = page.getByRole("checkbox", { name: "Comparar" });
  await expect(compareBoxes).toHaveCount(7);

  // 3 primeiros: Castro 2350 + Raul 3220 + Ahú 3136 → ordem: 2350, 3136, 3220.
  await compareBoxes.nth(0).check();
  await compareBoxes.nth(1).check();
  await compareBoxes.nth(2).check();

  const bar = page.getByTestId("compare-bar");
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("3 selecionados");

  await page.getByTestId("compare-open").click();
  const table = page.getByTestId("compare-table");
  await expect(table).toBeVisible();

  // Ordem default por custo total efetivo (colunas: Castro, Ahú, Raul).
  const cols = table.getByTestId("compare-col");
  await expect(cols).toHaveCount(3);
  await expect(cols.nth(0)).toContainText("R$ 2.350");
  await expect(cols.nth(1)).toContainText("R$ 3.136");
  await expect(cols.nth(2)).toContainText("R$ 3.220");

  // S012: metragem em cada escolha — título + m² + preço no cabeçalho.
  await expect(cols.nth(0)).toContainText("123m²");
  await expect(cols.nth(1)).toContainText("78m²");
  await expect(cols.nth(2)).toContainText("90m²");

  // Totais corretos + flags honestas + links originais clicáveis.
  // (3 primeiros têm vaga — "sem garagem" é do Bufren, fora da seleção.)
  await expect(table).toContainText("R$ 2.350");
  await expect(table).toContainText("cond a confirmar");
  await expect(table).toContainText("Isento");
  const links = table.getByRole("link", { name: "Ver anúncio" });
  await expect(links).toHaveCount(3);
  for (const [i, id] of [
    "2912679822",
    "2912848342",
    "2912831367",
  ].entries()) {
    expect(await links.nth(i).getAttribute("href")).toContain(id);
  }
  await page.screenshot({ path: "test-results/s005-comparacao.png" });

  // 4º entra; 5º bloqueia com aviso visível (lista inalterada).
  await page.keyboard.press("Escape");
  await expect(table).toBeHidden();
  await compareBoxes.nth(3).check();
  await expect(bar).toContainText("4 selecionados");
  // 5º clique não marca (bloqueio) — click sem assert de estado.
  await compareBoxes.nth(4).click();
  // Checkbox do 5º segue desmarcado + aviso de bloqueio visível.
  await expect(compareBoxes.nth(4)).not.toBeChecked();
  await expect(page.getByTestId("compare-blocked")).toBeVisible();
  await expect(bar).toContainText("4 selecionados");

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});
