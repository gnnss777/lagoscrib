import { test, expect, type Page } from "@playwright/test";
import { collectConsoleErrors, openApp } from "./open-app";

// Busca e quadro são dois modos de visualização do MESMO pool (lib/pool.ts
// getAllApartments). A prova aqui é behavior, não arquitetura: excluir na
// busca tem que baixar a contagem do funil no quadro, e mover no quadro tem que
// trocar a badge de status na busca.
//
// Sem login: o gate client-side está em open access (NEXT_PUBLIC_OPEN_ACCESS),
// então o app abre direto no Dashboard. Se voltar a exigir login, este spec
// precisa readicionar o passo de autenticação.
//
// O contador do header é a fonte boa de "quantos imóveis o modo atual mostra"
// (Dashboard.tsx:250) — vale mais que contar cards, que sofre com coluna
// recolhida no quadro.

/** Contador do header para o modo ativo. */
async function poolCount(page: Page, mode: "busca" | "quadro"): Promise<number> {
  const re =
    mode === "busca" ? /(\d+)\s+apartamentos encontrados/ : /(\d+)\s+imóveis no funil/;
  await expect(page.getByTestId(`view-${mode}`)).toBeVisible();
  // getByRole("banner"), não locator("header"): cada coluna do quadro também
  // é um <header> e o locator genérico casa 9 elementos (strict mode).
  const header = page.getByRole("banner");
  await expect(header).toContainText(re);
  const text = (await header.textContent()) ?? "";
  const match = text.match(re);
  if (!match) throw new Error(`contagem do modo ${mode} não encontrada em: ${text}`);
  return Number(match[1]);
}

function goTo(page: Page, mode: "busca" | "quadro") {
  return page.locator(`[data-view-mode="${mode}"]`).click();
}

test("test_pool_compartilhado_excluir_na_busca_some_no_quadro", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  // O botão Excluir pede confirmação via window.confirm.
  page.on("dialog", (dialog) => void dialog.accept());

  await openApp(page);
  const listaAntes = await poolCount(page, "busca");
  expect(listaAntes).toBeGreaterThan(0);
  // O contador do header bate com os cards efetivamente renderizados.
  await expect(page.locator(".card-apartment")).toHaveCount(listaAntes);

  // O quadro mostra o pool COMPLETO (aluguel + venda); a busca, só a aba
  // ativa. Por isso >=, e não ==: a base muda a cada leva de coleta e um literal
  // aqui quebraria sem que nada do produto mudasse.
  await goTo(page, "quadro");
  const quadroAntes = await poolCount(page, "quadro");
  expect(quadroAntes).toBeGreaterThanOrEqual(listaAntes);

  // Volta pra busca e exclui o primeiro card.
  await goTo(page, "busca");
  const titulo = (
    await page.locator(".card-apartment").first().locator("h3").textContent()
  )?.trim();
  expect(titulo).toBeTruthy();

  await page.getByRole("button", { name: `Excluir ${titulo}` }).click();
  await expect(page.locator(".card-apartment")).toHaveCount(listaAntes - 1);
  await expect(page.getByRole("button", { name: `Excluir ${titulo}` })).toHaveCount(0);

  // O mesmo imóvel não pode sobrar no quadro — nem em coluna recolhida, que é
  // por isso que a ausência é checada no documento inteiro.
  await goTo(page, "quadro");
  expect(await poolCount(page, "quadro")).toBe(quadroAntes - 1);
  await expect(page.getByText(titulo!, { exact: false })).toHaveCount(0);

  // E persiste: a remoção é filtro do pool (REMOVED_IDS), não estado de UI.
  await page.reload();
  expect(await poolCount(page, "quadro")).toBe(quadroAntes - 1);

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_mover_no_quadro_reflete_na_busca", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  page.on("dialog", (dialog) => void dialog.accept());

  await openApp(page);
  // Pega o imóvel pelo QUADRO, não pela busca: os dois modos ordenam diferente,
  // e o card escolhido na busca pode cair na lista recolhida de uma coluna —
  // onde o botão de mover existe mas o menu não abre visível.
  await goTo(page, "quadro");
  const primeiroCard = page.locator("article").first();
  const titulo = (
    await primeiroCard.getByRole("button", { name: /^Abrir detalhes de / }).getAttribute("aria-label")
  )?.replace("Abrir detalhes de ", "");
  expect(titulo).toBeTruthy();

  // Move para Contactado pelo menu do card no quadro (destino "fim").
  await page
    .getByRole("button", { name: `Mover ${titulo}, abrir menu de destinos` })
    .click();
  const menu = page.getByRole("menu", { name: `Ações de ${titulo}` });
  await expect(menu).toBeVisible();
  await menu
    .locator('div[role="none"]')
    .filter({ hasText: "Contactado" })
    .getByRole("menuitem", { name: "fim" })
    .click();

  // Mesmo funil, mesma badge: a busca não tem estado próprio de status.
  await goTo(page, "busca");
  const cardDepois = page
    .locator(".card-apartment")
    .filter({ has: page.locator("h3", { hasText: titulo! }) });
  await expect(cardDepois.locator(".status-badge")).toHaveText("Contactado");

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});
