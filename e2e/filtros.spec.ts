import { test, expect, type Page } from "@playwright/test";
import { openApp, signInIfNeeded } from "./open-app";
import { RENT_PRICE_BOUNDS, PRICE_SLIDER_RENT_STEPS } from "@/lib/constants";
import { activePool, expectedCards } from "./pool-count";

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

// Aluguel é slider linear de 0 a RENT_PRICE_BOUNDS.max em
// PRICE_SLIDER_RENT_STEPS passos. A posição deriva das constantes: fixar
// números aqui quebrava sozinho quando o teto do filtro mudou (20k → 40k).
const rentPos = (preco: number) =>
  Math.round((preco / RENT_PRICE_BOUNDS.max) * PRICE_SLIDER_RENT_STEPS);
const RENT_POS_3800 = rentPos(3800);
const RENT_POS_1000 = rentPos(1000);

function resetState(page: Page) {
  const clear = page.evaluate(() => {
    localStorage.removeItem("apartamentos-app-removed");
    localStorage.removeItem("apartamentos-app-filters");
    localStorage.removeItem("apartamentos-app-sort");
  });
  return clear;
}

async function login(page: Page) {
  await openApp(page);
  await expect(page.locator(".card-apartment")).toHaveCount(expectedCards());
}

/**
 * Mesma combinação do teste, contada no dado em vez de no literal.
 *
 * "3+ quartos + all-in até R$ 3.800 + Elevador" é o recorte que o painel de
 * filtros monta, e a resposta muda a cada leva (o `toHaveCount(2)` deste spec
 * virou 6 quando a base foi de 89 para 152). Derivado aqui, com a MESMA regra
 * de aplicação do app: facilities só excluem quem tem `features` declarado
 * (`applyFilters`), e `total` é o all-in (rent + condo + IPTU).
 */
function combinedCount(quartosMin: number, priceMax: number, facility: string): number {
  const { pool } = activePool();
  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
  return pool.filter((a) => {
    // `sale` em variável: comparar `a.transaction` duas vezes deixa o TS
    // estreitar o tipo na segunda e acusar comparação impossível.
    const sale = a.transaction === "venda";
    const price = sale ? (a.salePrice ?? a.total) : a.total;
    if (sale) return false;
    if (a.bedrooms != null && a.bedrooms < quartosMin) return false;
    if (typeof price !== "number" || price > priceMax) return false;
    const features = a.features ?? [];
    if (features.length === 0) return true; // regra 3: dado ausente nunca exclui
    return features.some((f) => {
      const feat = normalize(f);
      return (
        feat.includes(normalize(facility)) &&
        !feat.includes(`sem ${normalize(facility)}`) &&
        !feat.includes(`s/${normalize(facility)}`)
      );
    });
  }).length;
}

const COMBINADO = combinedCount(3, 3800, "Elevador");

test("test_filtros_combinacao_teclado_persistencia_sort_empty", async ({
  page,
}) => {
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
  await login(page);
  await resetState(page);

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

  // 3+ quartos + máx R$ 3.800 + Elevador. A contagem vem de combinedCount(), que
  // aplica a MESMA regra do lib/filters sobre a base ativa.
  await page.locator("#f-quartos").selectOption("3");
  await setRange(page, "Preço máximo", RENT_POS_3800);
  expect(COMBINADO, "a combinação do teste não casa mais com nenhum imóvel").toBeGreaterThan(0);
  await expect(page.locator(".card-apartment")).toHaveCount(COMBINADO);
  // Preço máximo R$ 3.800 (all-in) — nenhum card passa do teto. O texto do
  // card é o `total`, então acima de 3.800 o prefixo seria "R$ 4." ou mais.
  const gridText = (await page.locator("main").textContent()) ?? "";
  expect(gridText).not.toContain("R$ 4.");

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
  await signInIfNeeded(page);
  await expect(page.locator(".card-apartment")).toHaveCount(COMBINADO);
  // Painel abre fechado (só os filtros persistem) — reabre p/ conferir.
  await page.getByTestId("filter-toggle").click();
  await expect(
    page.getByRole("slider", { name: "Preço máximo" }),
  ).toHaveValue(String(RENT_POS_3800));

  // Limpar volta ao pool inteiro (painel já está aberto da conferência acima).
  await page.getByRole("button", { name: "Limpar filtros" }).first().click();
  await expect(page.locator(".card-apartment")).toHaveCount(expectedCards());

  // AC-FILT-04: sort menor preço → o all-in mais barato da base primeiro; maior
  // área → a maior metragem. Ambos derivados do pool (o "R$ 1.152/mês" fixo era
  // o 1º card por sorte da leva e não por contrato).
  await page.locator("#dash-sort").selectOption("menor-preco");
  const maisBarato = [...activePool().pool]
    .filter((a) => a.transaction !== "venda")
    .sort((x, y) => x.total - y.total)[0];
  await expect(page.locator(".card-apartment").first()).toContainText(
    `R$ ${maisBarato.total.toLocaleString("pt-BR")}/mês`,
  );
  await page.locator("#dash-sort").selectOption("maior-area");
  const maiorArea = [...activePool().pool]
    .filter((a) => a.transaction !== "venda")
    .sort((x, y) => y.area - x.area)[0];
  await expect(page.locator(".card-apartment").first()).toContainText(
    `${maiorArea.area}m²`,
  );

  // AC-FILT-09: empty state cita os filtros + limpar dentro
  // (painel segue aberto desde o Limpar acima).
  await setRange(page, "Preço máximo", RENT_POS_1000);
  await expect(page.locator(".card-apartment")).toHaveCount(0);
  await expect(page.getByText(/Nenhum imóvel com os .* filtros/)).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).last().click();
  await expect(page.locator(".card-apartment")).toHaveCount(expectedCards());

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});

test("test_filtros_bairro_novo_aparece_no_dropdown", async ({ page }) => {
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
  await signInIfNeeded(page);
  // Base + 1: o imóvel importado entra no pool (chave `apartamentos-app-new`).
  await expect(page.locator(".card-apartment")).toHaveCount(
    expectedCards() + 1,
  );
  await expect(page.locator("#dash-bairro")).toContainText("BairroE2EFiltros");
  await page.locator("#dash-bairro").selectOption("BairroE2EFiltros");
  await expect(page.locator(".card-apartment")).toHaveCount(1);
  await expect(page.locator(".card-apartment").first()).toContainText(
    "Ap Teste Filtros"
  );

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});
