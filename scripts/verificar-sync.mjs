/**
 * Verificação manual do sync entre dispositivos (não faz parte da suíte).
 *
 * A suíte e2e roda em `environment: node` sem Redis; isto precisa da app no ar
 * com UPSTASH_* configurado. Rodar:
 *
 *   node scripts/verificar-sync.mjs
 *
 * Simula dois aparelhos: um exclui um imóvel, o outro (contexto separado, sem
 * localStorage em comum) tem de enxergar o excluído. É o problema reportado:
 * "abri no outro PC e não tava atualizado".
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.SYNC_BASE_URL ?? "http://localhost:3000";
const TOKEN = (
  process.env.SYNC_TOKEN ??
  readFileSync("C:/Users/gnnss/AppData/Local/Temp/opencode/sync-token.txt", "utf8")
).trim();

/** Ativa o sync antes do app montar, senão o primeiro pull sai vazio. */
async function abrirAparelho(browser, rotulo) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(
    ([token]) => {
      try {
        window.localStorage.setItem("apartamentos-app-sync-token", token);
      } catch {
        // origin vazio no about:blank: o init script roda antes de existir origin
      }
    },
    [TOKEN],
  );
  const page = await ctx.newPage();
  page.on("dialog", (d) => void d.accept());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });

  // O app abre direto (open access) ou pede login (NEXT_PUBLIC_OPEN_ACCESS=0,
  // que é como o outro agente roda local). Nos dois casos o alvo é o Dashboard.
  const usuario = page.getByPlaceholder("Digite seu usuário");
  const card = page.locator(".card-apartment").first();
  // Corrida: em DOMContentLoaded o LoginPage pode ainda não ter renderizado, e
  // checar o campo cedo demais fazia o script pular o login e clicar num botão
  // desabilitado.
  await Promise.race([
    usuario.waitFor({ state: "visible", timeout: 20_000 }),
    card.waitFor({ state: "visible", timeout: 20_000 }),
  ]);
  if (await usuario.isVisible().catch(() => false)) {
    await usuario.fill(process.env.E2E_USER ?? "guinness");
    await page
      .getByPlaceholder("Digite sua senha")
      .fill(process.env.E2E_PASS ?? "curitiba2026");
    await page.getByRole("button", { name: "Entrar" }).click();
  }
  await card.waitFor({ state: "visible", timeout: 30_000 });
  // Espera o pull terminar: o chip só vira "Sincronizado" depois do merge.
  await page.getByRole("button", { name: "Estado da sincronização" }).waitFor({
    timeout: 15_000,
  });
  console.log(`  ${rotulo}: ${await page.locator(".card-apartment").count()} cards, sync ok`);
  return { ctx, page };
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
try {
  console.log("abrindo dois aparelhos independentes...");
  const pc1 = await abrirAparelho(browser, "PC1");
  const pc2 = await abrirAparelho(browser, "PC2");

  const titulo = (await pc1.page.locator(".card-apartment").first().locator("h3").textContent())?.trim();
  console.log(`\nimóvel alvo: "${titulo}"`);

  const antes = {
    pc1: await pc1.page.getByRole("button", { name: `Excluir ${titulo}` }).count(),
    pc2: await pc2.page.getByRole("button", { name: `Excluir ${titulo}` }).count(),
  };
  console.log(`antes  -> PC1: ${antes.pc1}  PC2: ${antes.pc2}`);
  if (antes.pc1 !== 1 || antes.pc2 !== 1) {
    throw new Error("o imóvel alvo não está visível nos dois aparelhos");
  }

  // PC1 exclui. O window.confirm já tem handler em abrirAparelho (dois
  // handlers no mesmo dialog estouram com "already handled").
  await pc1.page.getByRole("button", { name: `Excluir ${titulo}` }).click();
  await pc1.page
    .getByRole("button", { name: `Excluir ${titulo}` })
    .waitFor({ state: "detached", timeout: 15_000 });
  console.log(`\nPC1 excluiu. aguardando o push (debounce ${"2500"}ms)...`);
  await espera(4000);

  // PC2 recarrega: o pull tem de trazer o excluído.
  await pc2.page.reload({ waitUntil: "domcontentloaded" });
  await pc2.page.waitForSelector(".card-apartment", { timeout: 30_000 });
  // O primeiro card aparece no render inicial, bem antes do pull terminar —
  // conferir ali dava falso negativo. O chip é o que diz que o merge acabou.
  const chip = pc2.page.getByRole("button", { name: "Estado da sincronização" });
  await chip.waitFor({ timeout: 20_000 });
  await pc2.page
    .waitForFunction(
      () => {
        const b = document.querySelector('[aria-label="Estado da sincronização"]');
        return b?.textContent?.trim() === "Sincronizado";
      },
      undefined,
      { timeout: 20_000 },
    )
    .catch(async () => {
      console.log(`  (chip ficou em: ${(await chip.textContent())?.trim()})`);
    });
  const depois = await pc2.page.getByRole("button", { name: `Excluir ${titulo}` }).count();
  console.log(`\ndepois -> PC2 enxerga o excluído? ${depois === 0 ? "SIM (0 ocorrências)" : `NAO (${depois})`}`);

  if (depois !== 0) {
    throw new Error("o excluído do PC1 não apareceu no PC2 — sync não propagou");
  }
  console.log("\nOK: exclusão do PC1 refletiu no PC2.");
} finally {
  await browser.close();
}
