import { test, expect } from "@playwright/test";
import { APP_PROFILES, resolveAppProfile } from "@/lib/constants";
import { openApp, signInIfNeeded } from "./open-app";
import { allPools, activePool, expectedCards } from "./pool-count";

// Prova de isolamento entre os DOIS clientes, no browser e no perfil que o
// `npm run dev`/`next build` serviu.
//
// Roda igual nos dois perfis (sem env = `dono`), porque o requisito não é "o
// app do thais abre", é "o app que abriu é O app do perfil, com a base dele, e
// nenhum id do outro cliente aparece em lugar nenhum". Para provar isso no
// perfil `thais` de verdade, é o mesmo comando com a env:
//
//     $env:NEXT_PUBLIC_PERFIL="thais"; npx playwright test e2e/perfil-isolamento.spec.ts
//
// O `data-perfil` e o <title> saem de app/layout.tsx; a base sai do alias
// `@/lib/base` que o next.config.js aponta por perfil. Este teste é o par
// "login/logout no perfil thais" que a suíte não tinha: o gate está LIGADO
// (NEXT_PUBLIC_OPEN_ACCESS=0 no .env.local), então entrar e sair é o caminho
// real do dono, e vale para os dois clientes.

const perfil = resolveAppProfile(process.env);
const outra = allPools().find((p) => p.perfil !== perfil)!;

test("test_perfil_atual_serve_identidade_e_base_dele_e_nao_da_outro", async ({ page }) => {
  await openApp(page);

  // --- Identidade por build: <html data-perfil> e o título da página.
  await expect(page.locator("html")).toHaveAttribute("data-perfil", perfil);
  await expect(page).toHaveTitle(new RegExp(APP_PROFILES[perfil].appName));
  // A marca do outro cliente não pode estar no título.
  await expect(page).not.toHaveTitle(new RegExp(APP_PROFILES[outra.perfil].appName));

  // --- Base do perfil: os cards do pool dele, e o contador do header bate.
  const esperado = expectedCards();
  await expect(page.locator(".card-apartment")).toHaveCount(esperado);
  await expect(page.getByRole("banner")).toContainText(
    new RegExp(`${esperado} apartamentos encontrados`),
  );

  // --- Nenhum id do OUTRO cliente no HTML servido (nem no pool, nem no
  // estado guardado no navegador). Amostra de 12 ids: é o bastante para pegar
  // alias trocado, base embutida por inteiro ou estado semeado do cliente
  // errado, sem pesar no teste.
  const html = (await page.content()).replace(/\s/g, "");
  const state = await page.evaluate(() => localStorage.getItem("apartamentos-app-state") ?? "");
  const vaza = outra.pool
    .slice(0, 12)
    .filter((a) => html.includes(a.id) || state.includes(a.id))
    .map((a) => a.id);
  expect(
    vaza,
    `ids do perfil ${outra.perfil} no build do perfil ${perfil}: ${vaza.join(", ")}`,
  ).toEqual([]);

  // --- E o contrário também: um id do perfil ATIVO está na tela.
  const idAtivo = activePool().pool[0].id;
  await expect(
    page.locator(`.card-apartment[data-id="${idAtivo}"]`),
  ).toHaveCount(1);
});

test("test_login_e_logout_no_perfil_atual", async ({ page }) => {
  // Estado de partida: o gate de login está na tela (NEXT_PUBLIC_OPEN_ACCESS=0
  // no .env.local deste projeto). O helper entra se precisar; se um dia o bypass
  // voltar, o teste ainda vale, porque o que ele prova é que a sessão fecha e o
  // pool some com ela.
  await page.goto("/");
  const usuario = page.getByPlaceholder("Digite seu usuário");

  await signInIfNeeded(page);
  await expect(page.locator(".card-apartment")).toHaveCount(expectedCards());
  // O nome de quem entrou é o do dono do perfil, não um resíduo do outro cliente.
  await expect(page.getByRole("banner")).toContainText(
    process.env.E2E_USER ?? "guinness",
  );

  // "Sair" fecha a sessão: o grid do perfil some e o form volta. O id do imóvel
  // do perfil não pode ficar em nenhum card depois disso.
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(usuario).toBeVisible();
  await expect(page.locator(".card-apartment")).toHaveCount(0);
  // E o título do perfil continua o dele (o logout não troca a identidade).
  await expect(page.locator("html")).toHaveAttribute("data-perfil", perfil);
});