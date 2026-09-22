import { test, expect } from "@playwright/test";

// S003 (AC-GAL-01/02 + AC-ZOOM-01): galeria viewer-first navegável +
// lightbox com zoom/pan + Esc + zero erro de console.
test("test_galeria_navegacao_zoom_esc_sem_erros", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  // Login (mesmo padrão do smoke: env ou fallbacks de dev).
  await page.goto("/");
  await page
    .getByPlaceholder("Digite seu usuário")
    .fill(process.env.E2E_USER ?? "guinness");
  await page
    .getByPlaceholder("Digite sua senha")
    .fill(process.env.E2E_PASS ?? "curitiba2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator(".card-apartment")).toHaveCount(7);

  // Abrir o primeiro imóvel → galeria viewer-first.
  await page.locator(".card-apartment").first().click();
  const gallery = page.getByTestId("gallery");
  await expect(gallery).toBeVisible();
  await expect(page.getByTestId("gallery-counter")).toHaveText("1/11");
  await expect(page.getByTestId("gallery-caption")).toHaveText("Foto principal");

  // Principal carrega de verdade (naturalWidth > 0).
  const mainImg = page.locator('[data-testid="gallery-main"] img');
  await expect(mainImg).toBeVisible();
  const naturalWidth = await mainImg.evaluate(
    (img: HTMLImageElement) => img.naturalWidth
  );
  expect(naturalWidth).toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/s003-galeria.png" });

  // Seta → 2/11; teclado →/← percorre com wrap.
  await page.getByTestId("gallery-next").click();
  await expect(page.getByTestId("gallery-counter")).toHaveText("2/11");
  await page.getByTestId("gallery-main").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("gallery-counter")).toHaveText("3/11");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("gallery-counter")).toHaveText("2/11");

  // Wrap: 1/11 → anterior → 11/11.
  await page.getByTestId("gallery-prev").click();
  await expect(page.getByTestId("gallery-counter")).toHaveText("1/11");
  await page.getByTestId("gallery-prev").click();
  await expect(page.getByTestId("gallery-counter")).toHaveText("11/11");

  // Thumb nº 5 → 5/11.
  await page.getByTestId("gallery-thumbs").getByRole("button").nth(4).click();
  await expect(page.getByTestId("gallery-counter")).toHaveText("5/11");

  // Lightbox: abre, zoom 1x→2x, Esc fecha e devolve o foco.
  await page.getByRole("button", { name: "Abrir zoom da foto" }).click();
  const lightbox = page.getByTestId("lightbox");
  await expect(lightbox).toBeVisible();
  await expect(page.getByTestId("lightbox-counter")).toHaveText("5/11");
  await page.getByTestId("lightbox-zoom").click();
  await expect(page.getByTestId("lightbox-zoom")).toContainText("2x");
  await page.screenshot({ path: "test-results/s003-zoom.png" });
  await page.keyboard.press("Escape");
  await expect(lightbox).toBeHidden();
  await expect(page.getByTestId("gallery")).toBeVisible();

  // Esc fecha o modal.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("gallery")).toBeHidden();
  await expect(page.locator(".card-apartment")).toHaveCount(7);

  expect(errors, `erros de console: ${errors.join(" | ")}`).toEqual([]);
});
