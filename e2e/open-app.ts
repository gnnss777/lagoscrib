import { expect, type Page } from "@playwright/test";

/**
 * Corta a sincronização com o servidor durante o teste.
 *
 * `lib/ownerState.ts` + `lib/AppContext.tsx` puxam `/api/owner-state` no mount
 * e no login, e `reconcileOnLoad` só recusa o remoto quando ele está vazio
 * INTEIRO. Num aparelho de teste o remoto não está vazio (o documento do dono
 * está no Upstash, via SYNC_TOKEN do .env.local), então o remoto vence e
 * `applySnapshot` reescreve as três chaves locais — `apartamentos-app-state`,
 * `apartamentos-app-removed` e `apartamentos-app-new`. Efeito observado: todo
 * imóvel/status/follow-up que o teste semeou some 1–2s depois do login, e os
 * testes que dependem disso morrem sem motivo aparente.
 *
 * Isso é um BUG DE CÓDIGO, não de teste (o reconcile deveria comparar campo a
 * campo) e ele está travado por `e2e/sync.test.ts` com `test.fail()`. Aqui o
 * corte é só isolamento de harness: as asserções continuam idênticas.
 */
const syncBloqueada = new WeakSet<Page>();

export function blockRemoteSync(page: Page): void {
  if (syncBloqueada.has(page)) return;
  syncBloqueada.add(page);
  // Resposta 200 com `data: null`, e NÃO `route.abort()` nem 503: o Chrome
  // registra AMBOS no console ("net::ERR_FAILED" no abort, "a server responded
  // with a status of 503" no 503), e os specs coletam erro de console como erro
  // de app — estão certos, então o barulho tem de ir embora, não o filtro.
  // `data: null` é a resposta que o próprio servidor dá quando ainda não há
  // documento gravado: o pull devolve `{ok:true, snapshot:null}`, o
  // reconcile mantém o local, e o PUT que vem em seguida é interceptado aqui
  // também — nada toca o documento do dono no Upstash.
  void page.route("**/api/owner-state**", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, stubbed: true }),
        })
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: null, stubbed: true }),
        }),
  );
}

/**
 * Entra no app se o gate de login estiver na tela. Opera na página ATUAL (não
 * navega), para quem já semeou estado antes.
 *
 * Por que os specs não podem mais confiar em `apartamentos-app-state`:
 * `isAuthenticated` vindo do localStorage é deliberadamente IGNORADO por
 * lib/AppContext.tsx (um `true` no storage não é sessão — aceitar seria um login
 * que qualquer um fabrica no console). E o bypass `NEXT_PUBLIC_OPEN_ACCESS` é
 * opt-out, desligado no `.env.local` deste projeto (`=0`). Os dois juntos
 * tinham 17 specs quebrados num gate de login que eles nem viam: o seeding
 * apontava para uma autenticação que o app não lê mais. O caminho de login é
 * o mesmo para todos agora — o form.
 *
 * O par preencher/clicar é REPETIDO de propósito. O formulário é SSR: ele
 * aparece no HTML antes da hidratação, e um `fill` nesse instante escreve só no
 * DOM — o input é controlado, então o React apaga o valor ao hidratar e o botão
 * "Entrar" continua `disabled`. Clicar assim dispara o submit nativo, o
 * NextAuth registra uma tentativa falha, e o throttle de lib/login-throttle.ts
 * trava a conta por 60s depois de 5 — o que derrubava metade da suíte de forma
 * intercalada. Botão habilitado é a barreira de hidratação: só o React
 * registrado os dois valores deixa ele habilitado.
 */
export async function signInIfNeeded(page: Page): Promise<void> {
  blockRemoteSync(page);
  const usuario = page.getByPlaceholder("Digite seu usuário");
  const senha = page.getByPlaceholder("Digite sua senha");
  const botao = page.getByRole("button", { name: "Entrar" });
  const user = process.env.E2E_USER ?? "guinness";
  const pass = process.env.E2E_PASS ?? "curitiba2026";

  await expect
    .poll(
      async () => {
        if (!(await usuario.isVisible().catch(() => false))) return "entrou";
        if (await botao.isEnabled().catch(() => false)) {
          await botao.click();
          return "entrou";
        }
        await usuario.fill(user).catch(() => {});
        await senha.fill(pass).catch(() => {});
        return "hidratando";
      },
      { timeout: 30_000, intervals: [200, 400, 800, 1500] },
    )
    .toBe("entrou");
  // O sumiço do form é a prova de que o servidor aceitou.
  await expect(usuario).toBeHidden();
}

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
  blockRemoteSync(page);
  await page.goto("/");
  await signInIfNeeded(page);
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
