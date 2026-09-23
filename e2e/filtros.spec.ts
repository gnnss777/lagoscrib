import { test, expect, type Page } from "@playwright/test";

// S009 (AC-FILT-01..10): combinação quartos+preço+facilidade, teclado/Esc/foco,
// persistência no reload, sort, empty state com limpar, zero console errors.
//
// Preço é slider duplo (leva kanban-tela-inteira-ui): thumbs são
// input[type=range] controlados pelo React — setRange usa o setter nativo
// (único caminho que dispara onChange em input controlado).
async function setRange(page: Page, name: string, pos: number) {
  const slider = page.getByRole("slider", { name });
  await slider.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(input, String(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, pos);
}

// Aluguel linear 0–20k em 400 passos (R$50/passo): pos = preço / 50.
const RENT_POS_3800 = 76;
const RENT_POS_1000 = 20;

async function login(page: Page) {
  await page.goto("/");
  await page
    .getByPlaceholder("Digite seu usuário")
    .fill(process.env.E2E_USER ?? "guinness");
  await page
    .getByPlaceholder("Digite sua senha")
    .fill(process.env.E2E_PASS ?? "curitiba2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator(".card-apartment")).toHaveCount(7);
}

test("test_filtros_combinacao_teclado_persistencia_sort_empty", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await login(page);

  const toggle = page.getByTestId("filter-toggle");

  // AC-FILT-06: abre via teclado, Esc fecha e devolve o foco.
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("filter-panel")).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("filter-panel")).toBeHidden();
  await expect(toggle).toBeFocused();

  // Chip operável por teclado (Enter alterna aria-pressed).
  await toggle.click();
  const elevador = page.getByRole("button", { name: /Elevador · \d+/ });
  await elevador.focus();
  await page.keyboard.press("Enter");
  await expect(elevador).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "test-results/s009-painel.png" });

  // AC-FILT-01: 3+ quartos + máx R$ 3.800 + Elevador → só o Comendador.
  await page.locator("#f-quartos").selectOption("3");
  await setRange(page, "Preço máximo", RENT_POS_3800);
  await expect(page.locator(".card-apartment")).toHaveCount(1);
  await expect(page.getByText("1 de 7 apartamentos")).toBeVisible();
  const main = ((await page.locator("main").textContent()) ?? "").replace(
    /\s/g,
    " "
  );
  expect(main).toContain("R$ 3.629");

  // AC-FILT-03: reload restaura (aguarda o debounce de 300ms via poll).
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => localStorage.getItem("apartamentos-app-filters") ?? ""
        ),
      { timeout: 5000 }
    )
    .toContain("3800");
  await page.reload();
  await expect(page.locator(".card-apartment")).toHaveCount(1);
  // Painel abre fechado (só os filtros persistem) — reabre p/ conferir.
  await page.getByTestId("filter-toggle").click();
  await expect(
    page.getByRole("slider", { name: "Preço máximo" }),
  ).toHaveValue(String(RENT_POS_3800));

  // Limpar volta aos 7 (painel já está aberto da conferência acima).
  await page.getByRole("button", { name: "Limpar filtros" }).first().click();
  await expect(page.locator(".card-apartment")).toHaveCount(7);

  // AC-FILT-04: sort menor preço → Castro primeiro; maior área → 130m².
  await page.locator("#dash-sort").selectOption("menor-preco");
  await expect(page.locator(".card-apartment").first()).toContainText(
    "R$ 2.350"
  );
  await page.locator("#dash-sort").selectOption("maior-area");
  await expect(page.locator(".card-apartment").first()).toContainText("130m²");

  // AC-FILT-09: empty state cita os filtros + limpar dentro
  // (painel segue aberto desde o Limpar acima).
  await setRange(page, "Preço máximo", RENT_POS_1000);
  await expect(page.locator(".card-apartment")).toHaveCount(0);
  await expect(page.getByText(/Nenhum imóvel com os .* filtros/)).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).last().click();
  await expect(page.locator(".card-apartment")).toHaveCount(7);

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_filtros_bairro_novo_aparece_no_dropdown", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await login(page);

  // AC-FILT-02: imóvel novo entra no dropdown de bairro e filtra.
  await page.getByRole("button", { name: "Adicionar Novo Imóvel" }).click();
  await page.getByPlaceholder("Título", { exact: true }).fill("Ap Teste Filtros");
  await page.getByPlaceholder("Bairro", { exact: true }).fill("BairroE2EFiltros");
  await page
    .getByPlaceholder("Link do anúncio (OLX/VivaReal)")
    .fill("https://exemplo.com/e2e-filtros");
  await page.getByRole("button", { name: "Importar Novo Imóvel" }).click();
  await page.reload();
  await expect(page.locator(".card-apartment")).toHaveCount(8);
  await expect(page.locator("#dash-bairro")).toContainText("BairroE2EFiltros");
  await page.locator("#dash-bairro").selectOption("BairroE2EFiltros");
  await expect(page.locator(".card-apartment")).toHaveCount(1);
  await expect(page.locator(".card-apartment").first()).toContainText(
    "Ap Teste Filtros"
  );

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});
