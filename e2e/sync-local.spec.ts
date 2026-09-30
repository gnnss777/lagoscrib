import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// P0 — perda de dado do dono pelo sync (CORRIGIDO, teste normal)
//
// `lib/AppContext.tsx` puxa `/api/owner-state` no mount e a cada virada de
// `isAuthenticated` (isto é, no login). O `reconcileOnLoad` (lib/ownerState.ts)
// adotava o documento remoto INTEIRO sempre que ele não estivesse vazio inteiro:
//
//     if (vazio(remote) && !vazio(local)) return { snapshot: local, ... }
//     return { snapshot: remote, adoptedRemote: true };
//
// Num aparelho de teste o remoto NÃO está vazio (o documento do dono está no
// Upstash, alcançado pelo cookie de sessão), então o remoto vencia e
// `applySnapshot` reescrevia as três chaves locais: `apartamentos-app-state`
// (notas/status/checklist/follow-ups), `apartamentos-app-removed` e
// `apartamentos-app-new` (imóveis cadastrados à mão).
//
// O dano: quem cadastra um imóvel e recarrega perde o imóvel; quem tinha kanban
// e follow-ups locais perde o histórico. Foi o que derrubou 5 specs e2e (form,
// filtros-bairro-novo, dedupe, sem-retorno, delete-new) com sintoma de "o dado
// semeado sumiu" e nenhum erro no console.
//
// O conserto foi mesclar campo a campo (`mergeSnapshots`): `userAdded`,
// `removedIds` e `notes` por união; `statuses` por last-write-wins no
// `updatedAt` do próprio campo; `checklist`/`followUps` por união de chave com
// o valor do remoto. Este teste deixou de ser `test.fail()` na mesma hora — é
// o que trava a regressão agora.
//
// NÃO usar `signInIfNeeded` aqui: ele corta `/api/owner-state` (isolamento de
// harness, ver e2e/open-app.ts) e com o corte este bug simplesmente não
// aparece — que é justamente o que se quer provar que acontece.
// ---------------------------------------------------------------------------
test("test_sync_remoto_nao_apaga_o_que_esta_so_no_local", async ({ page }) => {
  const seed = {
    isAuthenticated: true,
    username: "guinness",
    notes: [
      {
        id: "n1",
        apartmentId: "x",
        text: "nota local",
        createdAt: "2026-09-20T10:00:00.000Z",
      },
    ],
    statuses: [
      { apartmentId: "x", status: "agendado", updatedAt: "2026-09-20T10:00:00.000Z" },
    ],
    followUps: {
      x: { attempts: 2, status: "aguardando", lastContactAt: "2026-09-15T12:00:00.000Z" },
    },
  };
  const meu = {
    id: "imóvel-do-dono",
    title: "Imóvel cadastrado à mão",
    neighborhood: "Batel",
    address: "Rua de teste",
    area: 70,
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
    rent: 2500,
    condo: 0,
    iptu: 0,
    total: 2500,
    phone: "",
    email: "",
    link: "https://exemplo.com/x",
    image: "/imoveis/zap-portao-124-5525.webp",
    features: [],
    description: "",
  };

  await page.addInitScript(
    ({ s, m }) => {
      localStorage.setItem("apartamentos-app-state", JSON.stringify(s));
      localStorage.setItem("apartamentos-app-new", JSON.stringify([m]));
    },
    { s: seed, m: meu },
  );
  await page.goto("/");

  // Login pelo form, sem o helper: aqui a rota de sync precisa ficar viva.
  const usuario = page.getByPlaceholder("Digite seu usuário");
  await expect(usuario).toBeVisible();
  await usuario.fill(process.env.E2E_USER ?? "guinness");
  await page
    .getByPlaceholder("Digite sua senha")
    .fill(process.env.E2E_PASS ?? "curitiba2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(usuario).toBeHidden();
  await expect(page.locator(".card-apartment").first()).toBeVisible();

  // Deixa o pull de mount e o de pós-login acontecerem.
  await page.waitForTimeout(4000);

  const depois = await page.evaluate(() => ({
    novo: JSON.parse(localStorage.getItem("apartamentos-app-new") ?? "[]") as {
      id: string;
    }[],
    state: JSON.parse(localStorage.getItem("apartamentos-app-state") ?? "{}") as {
      notes?: unknown[];
      followUps?: Record<string, unknown>;
    },
  }));
  expect(
    depois.novo.map((a) => a.id),
    "o imóvel cadastrado à mão sumiu do pool local",
  ).toContain(meu.id);
  expect(depois.state.notes ?? [], "a nota local sumiu").toHaveLength(1);
  expect(Object.keys(depois.state.followUps ?? {}), "o follow-up local sumiu").toContain(
    "x",
  );
});