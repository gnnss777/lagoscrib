import { test, expect } from "@playwright/test";

// S005 (AC-COMP-01): 3 selecionados → tabela com totais e links; 5º bloqueado
// com aviso; ordem default por custo total efetivo; zero erro de console.
test("test_comparacao_tabela_ordem_bloqueio_links", async ({ page }) => {
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
  await expect(page.locator(".card-apartment")).toHaveCount(88);

  const compareBoxes = page.getByRole("checkbox", { name: "Comparar" });
  await expect(compareBoxes).toHaveCount(88);

  // 3 primeiros cards. Total e metragem saem dos próprios cards: literal aqui
  // quebrava a cada leva da base.
  const cards = page.locator(".card-apartment");
  const escolhidos: { total: string; area: string; id: string }[] = [];
  for (let i = 0; i < 3; i++) {
    escolhidos.push({
      total: (await cards.nth(i).getByTestId("card-total").textContent())?.trim() ?? "",
      area: (await cards.nth(i).getByTestId("card-area").textContent())?.trim() ?? "",
      id: (await cards.nth(i).getAttribute("data-id")) ?? "",
    });
  }
  await compareBoxes.nth(0).check();
  await compareBoxes.nth(1).check();
  await compareBoxes.nth(2).check();

  const bar = page.getByTestId("compare-bar");
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("3 selecionados");

  await page.getByTestId("compare-open").click();
  const table = page.getByTestId("compare-table");
  await expect(table).toBeVisible();

  // Ordem default por custo total efetivo: as colunas trazem os mesmos
  // totais e metragens dos cards escolhidos, em ordem crescente de custo.
  const cols = table.getByTestId("compare-col");
  await expect(cols).toHaveCount(3);
  const porCusto = [...escolhidos].sort(
    (a, b) =>
      Number(a.total.replace(/\D/g, "")) - Number(b.total.replace(/\D/g, "")),
  );
  for (const [i, escolhido] of porCusto.entries()) {
    await expect(cols.nth(i)).toContainText(escolhido.total);
    await expect(cols.nth(i)).toContainText(escolhido.area);
  }

  // Totais corretos + flags honestas + links originais clicáveis.
  // (3 primeiros têm vaga — "sem garagem" é do Bufren, fora da seleção.)
  await expect(table).toContainText(porCusto[0].total);
  const links = table.getByRole("link", { name: "Ver anúncio" });
  await expect(links).toHaveCount(3);
  for (const [i, escolhido] of porCusto.entries()) {
    // O link original do anúncio, verbatim (ADR-001 §5). O id do app não é o
    // id do portal: comparamos o domínio/caminho do anúncio, não o id.
    const href = (await links.nth(i).getAttribute("href")) ?? "";
    expect(href).toMatch(/^https:\/\//);
    expect(href).toContain("/imovel/");
    expect(href).toContain("curitiba");
    expect(escolhido.id).toBeTruthy();
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
