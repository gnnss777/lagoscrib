import { expect, type Page } from "@playwright/test";

/**
 * Deixa a página pronta para os testes, com ou sem o gate de login.
 *
 * O app roda em open access por padrão (NEXT_PUBLIC_OPEN_ACCESS, ver
 * lib/AppContext.tsx) e o gate de login legado é opt-out. Mas o modo legado
 * continua existindo, e sem este "se" a suíte inteira morre no primeiro
 * `getByPlaceholder` se alguém religar o login — que é exatamente o que
 * aconteceu quando o bypass entrou.
 *
 * Se o formulário estiver na tela, loga. Se não estiver, o app já abriu no
 * Dashboard e não há nada a fazer.
 */
export async function openApp(page: Page): Promise<void> {
  await page.goto("/");
  const usuario = page.getByPlaceholder("Digite seu usuário");
  if (await usuario.isVisible().catch(() => false)) {
    await usuario.fill(process.env.E2E_USER ?? "guinness");
    await page
      .getByPlaceholder("Digite sua senha")
      .fill(process.env.E2E_PASS ?? "curitiba2026");
    await page.getByRole("button", { name: "Entrar" }).click();
  }
  // O Dashboard é a prova de que chegamos: card na busca, qualquer que seja o modo.
  await expect(page.locator(".card-apartment").first()).toBeVisible();
}

/**
 * Mensagens de console que são ruído de harness, não bug do app.
 *
 * Centralizado porque o filtro estava copiado em 13 spec files e cada cópia
 * divergia. Adicionar um item aqui vale para a suíte inteira.
 */
const HARNESS_NOISE = [
  // Next dev mode emite "eval() is not supported" do React — não é erro app.
  "eval()",
  "Content-Security-Policy",
  // React dev: hydration mismatch por `style="caret-color:transparent"` nos
  // inputs. O atributo é injetado pelo Playwright, não pelo app. Só aparece
  // desde que o Dashboard passou a ser server-rendered (open access tirou o
  // gate client-side, que antes só nascia o Dashboard no client).
  "A tree hydrated but some attributes",
];

export function isHarnessNoise(text: string): boolean {
  return HARNESS_NOISE.some((needle) => text.includes(needle));
}

/** Cola um listener de console que empurra só o que não é ruído de harness. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text().trim();
      if (!isHarnessNoise(text)) errors.push(text);
    }
  });
  return errors;
}
