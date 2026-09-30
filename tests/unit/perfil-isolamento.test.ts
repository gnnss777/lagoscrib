import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { contrastRatio } from "@/lib/contrast";
import {
  emptySnapshot,
  reconcileOnLoad,
  type OwnerSnapshot,
} from "@/lib/ownerState";
import {
  APP_PROFILES,
  FILTERS_STORAGE_KEY,
  KANBAN_COLS_STORAGE_KEY,
  THEME_CONTRAST_TEXT,
  THEME_PALETTE,
  THEME_PALETTE_DUNGEON,
  type ThemeToken,
} from "@/lib/constants";
import { allPools } from "../../e2e/pool-count";

// Isolamento entre os DOIS clientes e as lacunas de contraste que o teste
// existente (tests/unit/lightbox-contrast.test.ts) não alcança.
//
// O que aquele teste já cobre, e não é repetido aqui: os pares de TOKEN das
// duas paletas, a ponte `@theme` <-> THEME_PALETTE, e o escopo
// [data-perfil="thais"] das duas regras de §1.1. O que ele NÃO cobre, e é o
// que este arquivo fecha: (a) o par texto-sobre-scrim de foto, que só existe
// depois que o CSS troca `--color-paper` por `--color-ink` dentro de
// `[class*="bg-night"]`; (b) a ponte CSS -> token dos componentes (`.btn-primary`,
// `.status-*`, `.input-field::placeholder`), que valida pares mas não valida que
// o componente use o token; (c) o isolamento de DADO entre as bases.

const CSS = readFileSync(join("app", "globals.css"), "utf8");

/** Recorta o corpo de uma regra do globals.css para checar token por token. */
function corpo(seletor: string): string {
  const i = CSS.indexOf(seletor);
  expect(i, `seletor ${seletor} não existe em globals.css`).toBeGreaterThan(-1);
  const aberto = CSS.indexOf("{", i);
  const fechado = CSS.indexOf("}", aberto);
  return CSS.slice(aberto + 1, fechado);
}

describe("isolamento de dado entre os dois clientes", () => {
  const [dono, thais] = allPools();

  it("test_as_duas_bases_tem_pelo_menos_um_imovel_cada", () => {
    expect(dono.pool.length).toBeGreaterThan(0);
    expect(thais.pool.length).toBeGreaterThan(0);
  });

  it("test_nenhum_id_compartilhado_entre_as_bases", () => {
    // A exigência do dono: os dois clientes NUNCA podem misturar imóvel nem
    // dado. Como o pool é a chave da tela (localStorage, notas, kanban), um id
    // repetido faria o card de um cliente marcar status do outro no mesmo
    // aparelho. É o teste que prova que o alias por perfil do next.config.js é
    // seguro, porque a garantia é do dado e não do bundle.
    const doDono = new Set(dono.pool.map((a) => a.id));
    const doThais = new Set(thais.pool.map((a) => a.id));
    const idsDono = dono.pool.map((a) => a.id);
    const idsThais = thais.pool.map((a) => a.id);
    expect(
      new Set(idsDono).size,
      "lib/data.ts tem id repetido (o dedupe por id do pool esconderia)",
    ).toBe(idsDono.length);
    expect(
      new Set(idsThais).size,
      "lib/data-thais.ts tem id repetido",
    ).toBe(idsThais.length);
    const emComum = idsThais.filter((id) => doDono.has(id));
    expect(emComum, `ids nas duas bases: ${emComum.join(", ")}`).toEqual([]);
  });

  it("test_as_bases_apontam_para_arquivos_diferentes_e_não_vazios", () => {
    expect(dono.base).toBe("lib/data.ts");
    expect(thais.base).toBe("lib/data-thais.ts");
    for (const base of [dono.base, thais.base]) {
      expect(statSync(base).size, `${base} está vazio`).toBeGreaterThan(1000);
    }
  });
});

describe("isolamento de identidade por perfil", () => {
  it("test_titulo_e_data_perfil_de_cada_perfil_nao_citam_o_outro", () => {
    for (const [perfil, meta] of Object.entries(APP_PROFILES)) {
      const outro = APP_PROFILES[perfil === "dono" ? "thais" : "dono"];
      for (const campo of [meta.appName, meta.appTitle, meta.ogDescription]) {
        expect(
          campo.toLowerCase(),
          `${perfil}: "${campo}" cita a marca do outro cliente`,
        ).not.toContain(outro.appName.toLowerCase());
      }
      //(app/layout.tsx põe `identidade.appTitle` no <title> e
      // `perfil` no data-perfil do <html> — as duas coisas vêm daqui.)
      expect(meta.appTitle).toContain(meta.appName);
    }
  });

  it("test_app_layout_escolhe_a_identidade_pela_mesma_env_do_next_config", () => {
    // Se app/layout.tsx e next.config.js divergissem na env, o build do `thais`
    // serviria a base da Thaís com a identidade do dono (ou o inverso): o app
    // ficaria certo por acidente num cliente e errado no outro.
    const layout = readFileSync(join("app", "layout.tsx"), "utf8");
    const config = readFileSync(join("next.config.js"), "utf8");
    for (const env of ["NEXT_PUBLIC_PERFIL", "NEXT_PUBLIC_BASE_ARQUIVO"]) {
      expect(layout, `app/layout.tsx não lê ${env}`).toContain(env);
      expect(config, `next.config.js não lê ${env}`).toContain(env);
    }
    // O dado vem do alias `@/lib/base`, e NENHUMA rota /api/* pode importar a
    // base estática: elas leem o Postgres (Prisma), e em produção não há
    // DATABASE_URL — um import de lib/base ali puxaria a base do dono para o
    // bundle do servidor do thais.
    const rotas = join("app", "api");
    const ofensoras: string[] = [];
    const visitar = (dir: string) => {
      for (const entrada of readdirSync(dir)) {
        const caminho = join(dir, entrada);
        if (statSync(caminho).isDirectory()) visitar(caminho);
        else if (/\.(ts|tsx)$/.test(entrada)) {
          const fonte = readFileSync(caminho, "utf8");
          if (/@\/lib\/(base|data|pool)/.test(fonte)) {
            ofensoras.push(caminho);
          }
        }
      }
    };
    visitar(rotas);
    expect(
      ofensoras,
      `rota /api/* importando a base estática: ${ofensoras.join(", ")}`,
    ).toEqual([]);
  });
});

describe("chaves de localStorage não colidem", () => {
  // A chave mora no componente (o recorte é dele, não de lib/constants.ts), e
  // importar o componente num teste de node puxaria JSX + os ícones. O valor é
  // lido do fonte — e é o fonte que é a fonte, como o próprio comentário do
  // componente diz.
  const section = readFileSync(
    join("app", "components", "KanbanSection.tsx"),
    "utf8",
  );
  const KANBAN_FILTERS_STORAGE_KEY =
    /KANBAN_FILTERS_STORAGE_KEY\s*=\s*"([^"]+)"/.exec(section)?.[1] ?? "";

  it("test_recorte_do_quadro_nao_usa_a_chave_da_busca", () => {
    // Se os dois filtros dividissem a chave, marcar "Bairro Alfa" no quadro
    // apareceria também na busca — e o `e2e/kanban-filtros.spec.ts` não
    // acusaria, porque os dois shines lariam o mesmo storage.
    expect(KANBAN_FILTERS_STORAGE_KEY).toBe("apartamentos-app-kanban-filters");
    expect(FILTERS_STORAGE_KEY).toBe("apartamentos-app-filters");
    expect(KANBAN_FILTERS_STORAGE_KEY).not.toBe(FILTERS_STORAGE_KEY);
    // Nem com as outras duas chaves do app (estado do imóvel e colunas).
    expect(KANBAN_FILTERS_STORAGE_KEY).not.toBe(KANBAN_COLS_STORAGE_KEY);
    expect(KANBAN_FILTERS_STORAGE_KEY).not.toBe("apartamentos-app-state");
  });
});

// ---------------------------------------------------------------------------
// Lacunas de contraste que o teste de paleta não alcança.
//
// `THEME_CONTRAST_TEXT` valida PARES DE TOKEN. O que ele não valida é (a) o par
// que só existe DEPOIS de uma regra de §1.1 trocar o token no escopo, e (b) se o
// componente usa mesmo o token que o par mede. Um `.btn-primary { color: ink }`
// passaria em todos os testes de contraste e estaria ilegível no perfil escuro.
// ---------------------------------------------------------------------------
/** Par (fg, bg) declarado por uma regra `.status-*` do globals.css. */
function parDoBadge(estado: string): { fg: ThemeToken; bg: ThemeToken } {
  const c = corpo(`.status-${estado} {`);
  const bg = /background:\s*var\(--color-([a-z-]+)\)/.exec(c)?.[1];
  const fg = /(?<!-)color:\s*var\(--color-([a-z-]+)\)/.exec(c)?.[1];
  expect(bg, `.status-${estado} sem fundo`).toBeTruthy();
  expect(fg, `.status-${estado} sem cor de texto`).toBeTruthy();
  return { fg: fg as ThemeToken, bg: bg as ThemeToken };
}

const ESTADOS_BADGE = [
  "novo",
  "visita",
  "visitado",
  "descartado",
  "inativo",
  "agendado",
  "feita",
  "negociacao",
  "aprovado",
  "recusado",
] as const;

describe("contraste de COMPONENTE (o que o teste de paleta não pega)", () => {
  const paletas = [
    ["dono", THEME_PALETTE],
    ["thais", THEME_PALETTE_DUNGEON],
  ] as const;

  it("test_texto_sobre_o_scrim_de_foto_passa_7_em_os_dois_temas", () => {
    // O scrim é `night` (o azul-noite do ícone, igual nos dois temas) e o
    // texto por cima é `text-paper` — que em [data-perfil="thais"] [class*=
    // "bg-night"] é REMAPEADO para `ink`. O par que o navegador pinta é:
    // tema claro = paper/night, tema escuro = ink/night. Nenhum dos dois está
    // em THEME_CONTRAST_TEXT, e é o par que segura legenda, contador e setas
    // do lightbox. Medido: paper/night no escuro dá 1.04:1 — sem a regra §1.1
    // item 2 o lightbox do perfil da Thaís fica ilegível.
    for (const [perfil, paleta] of paletas) {
      const fg: ThemeToken = perfil === "thais" ? "ink" : "paper";
      const ratio = contrastRatio(paleta[fg], paleta.night);
      expect(
        ratio,
        `${perfil}: texto sobre o scrim de foto = ${ratio.toFixed(2)}:1 (piso 7:1)`,
      ).toBeGreaterThanOrEqual(7);
    }
  });

  it("test_btn_primary_usa_on_accent_e_nao_ink", () => {
    // A CTA é gradiente táxi -> taxi-strong: o pior caso é a ponta clara. O
    // par forbidden (ink/taxi no escuro = 1.75:1) é o bug que §1.1 existe para
    // impedir, e ele só se cumpre se a regra do componente for `on-accent`.
    // O `:hover` só mexe em transform/shadow (F2.13), então a cor vem da
    // regra base — que é a que este teste mede.
    const base = corpo(".btn-primary {");
    expect(base, ".btn-primary não fixa a cor do texto").toContain(
      "var(--color-on-accent)",
    );
    expect(base, ".btn-primary usa ink, que quebra no tema escuro").not.toMatch(
      /color:\s*var\(--color-ink\)/,
    );
    // E o gradiente é sobre os dois acentos que o par de texto cobre.
    expect(base).toContain("var(--color-taxi)");
    expect(base).toContain("var(--color-taxi-strong)");
    for (const par of THEME_CONTRAST_TEXT.filter(
      (p) => p.bg === "taxi" || p.bg === "taxi-strong",
    )) {
      for (const [perfil, paleta] of paletas) {
        expect(
          contrastRatio(paleta[par.fg], paleta[par.bg]),
          `${perfil}: ${par.label}`,
        ).toBeGreaterThanOrEqual(par.floor);
      }
    }
  });

  it("test_badges_de_status_usa_par_declarado_e_bate_aaa_nos_dois_temas", () => {
    // Cada `.status-*` declara um par; o par tem de existir em
    // THEME_CONTRAST_TEXT (senão o badge nunca foi medido) e tem de passar nos
    // DOIS temas. `status-inativo` fica de fora de propósito: é o único que
    // não bate AAA no tema do dono e está travado no teste seguinte, com a
    // medição à mostra.
    for (const estado of ESTADOS_BADGE.filter((e) => e !== "inativo")) {
      const { fg, bg } = parDoBadge(estado);
      const par = THEME_CONTRAST_TEXT.find((p) => p.fg === fg && p.bg === bg);
      expect(
        par,
        `.status-${estado} usa ${fg}/${bg}, par que não está em THEME_CONTRAST_TEXT`,
      ).toBeTruthy();
      for (const [perfil, paleta] of paletas) {
        const ratio = contrastRatio(paleta[fg], paleta[bg]);
        expect(
          ratio,
          `${perfil}: badge ${estado} (${fg}/${bg}) = ${ratio.toFixed(2)}:1 (piso ${par!.floor}:1)`,
        ).toBeGreaterThanOrEqual(par!.floor);
      }
    }
  });

  // LACUNA REAL (não é opinion): `.status-inativo` usa `ink-soft` sobre `sand`,
  // que no tema do dono dá 6.28:1 — abaixo do piso AAA de 7:1 que o DESIGN.md §1
  // assume para o resto da lista, e o par não está em THEME_CONTRAST_TEXT. Passa
  // em AA (4.5:1). Conserto: declarar o par e trocar o texto do badge (`ink`) ou
  // o fundo. `it.fails` deixa a lacuna visível sem deixar a suíte vermelha — e
  // fica vermelho no dia da correção, que é o sinal para trocar por `it`.
  it.fails("test_badge_inativo_atinge_aaa_7_1 (hoje 6.28:1 no tema do dono)", () => {
    const { fg, bg } = parDoBadge("inativo");
    expect(contrastRatio(THEME_PALETTE[fg], THEME_PALETTE[bg])).toBeGreaterThanOrEqual(7);
  });
  it("test_badge_inativo_medido_hoje_6_28_no_dono_e_8_15_no_thais", () => {
    // A medição fica escrita aqui para o relatório não depender de executar
    // nada: sem `.status-inativo` este arquivo não registraria o número.
    const { fg, bg } = parDoBadge("inativo");
    expect(`${fg}/${bg}`).toBe("ink-soft/sand");
    expect(contrastRatio(THEME_PALETTE[fg], THEME_PALETTE[bg])).toBeCloseTo(
      6.28,
      1,
    );
    expect(contrastRatio(THEME_PALETTE_DUNGEON[fg], THEME_PALETTE_DUNGEON[bg])).toBeCloseTo(
      8.15,
      1,
    );
  });

  it("test_placeholder_do_input_usa_o_token_muted_e_passa_7", () => {
    // `.input-field` tem fundo `card`, e o placeholder é o token `muted` —
    // que o DESIGN.md reserva para placeholder/label. Se alguém trocar por um
    // cinza solto, o par continua validado e a tela fica ilegível.
    expect(corpo(".input-field {")).toContain("background: var(--color-card)");
    const ph = corpo(".input-field::placeholder {");
    expect(ph).toContain("var(--color-muted)");
    for (const [perfil, paleta] of paletas) {
      const ratio = contrastRatio(paleta.muted, paleta.card);
      expect(
        ratio,
        `${perfil}: placeholder no input = ${ratio.toFixed(2)}:1 (piso 7:1)`,
      ).toBeGreaterThanOrEqual(7);
    }
  });

  it("test_anel_de_foco_existe_para_input_e_thumb_do_slider", () => {
    // Foco visível é WCAG 2.2 e nenhum teste de contraste o vê: o que se mede é
    // cor sobre cor, não a presença do anel. Aqui só se prova que a regra
    // existe para os alvos que o CSS controla.
    expect(CSS).toContain(".input-field:focus");
    expect(corpo(".input-field:focus {")).toContain("var(--color-ink)");
    expect(CSS).toContain(".price-slider-input:focus-visible");
    expect(
      corpo(".price-slider-input:focus-visible::-webkit-slider-thumb {"),
    ).toContain("var(--color-ink)");
  });

  // O card da busca era a lacuna de teclado do app (achado do QC manual): o
  // `.card-apartment` era um `div` com `onClick`, sem `tabIndex`, sem `role` e
  // sem `onKeyDown` — logo a ação principal (abrir o DetailModal) só existia
  // para o mouse, e nenhum teste de contraste ou de foco acusaria. Este era
  // `it.fails` (a suíte ficava verde com a lacuna); virou `it` junto com o
  // conserto em app/components/ApartmentCard.tsx — `tabIndex={0}` + `onKeyDown`
  // (Enter/Espaço) + nome acessível, com o anel do `:focus-visible` global.
  it("test_card_da_busca_e_alcancavel_e_acionavel_pelo_teclado", () => {
    const card = readFileSync(
      join("app", "components", "ApartmentCard.tsx"),
      "utf8",
    );
    expect(card, ".card-apartment não é focável").toMatch(/tabIndex|role="button"/);
    expect(card, ".card-apartment não tem caminho por teclado").toContain("onKeyDown");
    // O caminho tem de abrir o DetailModal e não rolar a página (Espaço numa
    // div rolaria). E o anel de foco não pode depender de CSS novo: o
    // `:focus-visible` global do globals.css já cobre qualquer elemento
    // focalizável — por isso nada em globals.css foi tocado.
    const teclado = card.slice(
      card.indexOf("onKeyDown"),
      card.indexOf("onClick={() => onSelect(apartment)}"),
    );
    expect(teclado, "o teclado não aciona onSelect").toContain("onSelect(apartment)");
    expect(teclado, "Espaço sem preventDefault rola a página").toContain("preventDefault");
    expect(teclado, "Enter/Espaço semrecognizados").toMatch(/"Enter"/);
    expect(teclado, "falta a guarda: Enter no botão Excluir também abriria o modal").toContain(
      "e.target !== e.currentTarget",
    );
    expect(CSS, "o anel de foco global sumiu do base").toContain(":focus-visible {");
  });
});

/**
 * Prova do merge do estado do dono (lib/ownerState.ts).
 *
 * O sintoma: `reconcileOnLoad` adotava o documento remoto INTEIRO sempre que
 * ele não estivesse vazio inteiro. O documento do dono vive no Upstash, então
 * num aparelho real o remoto nunca está vazio e a substituição apagava o que só
 * existia aqui — o pior caso sendo o imóvel que o dono cadastrou à mão, que o
 * servidor não tem como conhecer. Dano simétrico: o aparelho que só lê
 * escrevia por cima do dono.
 *
 * `e2e/sync-local.spec.ts` prova o caminho inteiro no navegador (com o
 * Upstash real). Aqui a decisão em si, campo a campo, sem rede.
 */
describe("merge do estado do dono — o remoto não apaga o que é só local", () => {
  /** O imóvel digitado à mão: existe no aparelho e, por definição, no servidor não. */
  const MEU = { id: "imovel-do-dono", title: "Imóvel cadastrado à mão" };

  const em = (iso: string) => new Date(iso);

  const soLocal = (): OwnerSnapshot => ({
    ...emptySnapshot(em("2026-09-28T12:00:00.000Z")),
    userAdded: [MEU],
    notes: [
      { id: "n1", apartmentId: "x", text: "nota local", createdAt: "2026-09-20T10:00:00.000Z" },
    ],
    statuses: [
      { apartmentId: "x", status: "agendado", updatedAt: "2026-09-20T10:00:00.000Z" },
    ],
    followUps: { x: { attempts: 2, status: "aguardando" } },
  });

  /** O que já estava no Upstash: removido do dono + uma nota de outro imóvel. */
  const doServidor = (): OwnerSnapshot => ({
    ...emptySnapshot(em("2026-09-28T09:00:00.000Z")),
    removedIds: ["apolar-1"],
    notes: [
      { id: "n0", apartmentId: "y", text: "nota do servidor", createdAt: "2026-09-19T10:00:00.000Z" },
    ],
  });

  it("test_merge_imoveis_cadastrados_a_mao_sobrescrevem_o_documento_do_servidor", () => {
    // O bug travado, agora como teste normal: remoto sem o `userAdded` local
    // NÃO pode apagá-lo. Antes isto era substituição e o imóvel sumia no reload.
    const { snapshot, adoptedRemote } = reconcileOnLoad(soLocal(), doServidor());
    expect(adoptedRemote).toBe(true);
    expect(snapshot.userAdded.map((a) => (a as { id: string }).id)).toContain(MEU.id);
    // E o que o servidor tinha continua lá: o merge é união, não troca.
    expect(snapshot.notes.map((n) => n.id).sort()).toEqual(["n0", "n1"]);
    expect(snapshot.followUps.x).toEqual({ attempts: 2, status: "aguardando" });
    expect(snapshot.statuses).toHaveLength(1);
    expect(snapshot.removedIds).toEqual(["apolar-1"]);
  });

  it("test_merge_aparelho_novo_adota_o_documento_inteiro_do_servidor", () => {
    // O caso simétrico, que não pode quebrar: quem abre o site no celular
    // precisa ver o funil do dono. Local vazio não tem nada a preservar, então
    // o resultado tem de ser o remoto INTEIRO — e não "quase o remoto".
    const remoto = doServidor();
    const { snapshot, adoptedRemote } = reconcileOnLoad(
      emptySnapshot(em("2026-09-28T13:00:00.000Z")),
      remoto,
    );
    expect(adoptedRemote).toBe(true);
    expect(snapshot).toEqual(remoto);
  });

  it("test_merge_removedids_e_uniao_e_nao_substituicao", () => {
    // Decisão: `removedIds` é UNIÃO. É um conjunto de lápides — a exclusão vista
    // num aparelho não pode voltar por um documento que não a conhece, que era
    // o dano da substituição pura (imóvel excluído reaparecia no outro
    // aparelho). Encolher o conjunto não é operação do app: a única forma é
    // limpar o storage do aparelho, e limpar o storage joga as lápides daquele
    // aparelho fora junto.
    const local = { ...emptySnapshot(em("2026-09-28T12:00:00.000Z")), removedIds: ["apolar-local"] };
    const remoto = { ...doServidor(), removedIds: ["apolar-1", "apolar-2"] };
    const { snapshot } = reconcileOnLoad(local, remoto);
    expect(snapshot.removedIds).toEqual(["apolar-1", "apolar-2", "apolar-local"]);
    // União pura também não duplica o id que os dois lados conhecem.
    const { snapshot: deNovo } = reconcileOnLoad(
      { ...local, removedIds: ["apolar-1"] },
      remoto,
    );
    expect(deNovo.removedIds).toEqual(["apolar-1", "apolar-2"]);
  });

  it("test_merge_checklist_e_followups_preservam_a_chave_que_o_servidor_nao_conhece", () => {
    // União por CHAVE com o valor do remoto vencendo: preserva o histórico de
    // um imóvel que só existe aqui, mas NÃO une os itens de um checklist que o
    // servidor já viu — senão desticar um item num aparelho e voltar no outro o
    // traz de volta.
    const local: OwnerSnapshot = {
      ...emptySnapshot(em("2026-09-28T12:00:00.000Z")),
      checklist: { soAqui: ["pressao"], x: ["agua"] },
      followUps: { soAqui: { attempts: 3, status: "aguardando" }, x: { attempts: 9, status: "aguardando" } },
    };
    const remoto: OwnerSnapshot = {
      ...emptySnapshot(em("2026-09-28T09:00:00.000Z")),
      checklist: { x: [] },
      followUps: { x: { attempts: 1, status: "retornou" } },
    };
    const { snapshot } = reconcileOnLoad(local, remoto);
    expect(snapshot.checklist.soAqui, "chave só local sumiu").toEqual(["pressao"]);
    expect(snapshot.checklist.x, "o servidor desfez o destique").toEqual([]);
    expect(snapshot.followUps.soAqui).toEqual({ attempts: 3, status: "aguardando" });
    expect(snapshot.followUps.x).toEqual({ attempts: 1, status: "retornou" });
  });

  it("test_merge_statuses_e_uma_linha_por_imovel_e_vence_o_mais_novo", () => {
    // `statuses` é posição, não evento: duas linhas para o mesmo imóvel fazem o
    // card sumir da coluna. Então é last-write-wins pelo `updatedAt` do próprio
    // campo — e o empate é do remoto, que é o acumulado.
    const local: OwnerSnapshot = {
      ...emptySnapshot(em("2026-09-28T12:00:00.000Z")),
      statuses: [
        { apartmentId: "velho", status: "visita", updatedAt: "2026-09-20T10:00:00.000Z" },
        { apartmentId: "novo", status: "agendado", updatedAt: "2026-09-28T11:00:00.000Z" },
      ],
    };
    const remoto: OwnerSnapshot = {
      ...emptySnapshot(em("2026-09-28T09:00:00.000Z")),
      statuses: [
        { apartmentId: "velho", status: "descartado", updatedAt: "2026-09-25T10:00:00.000Z" },
        { apartmentId: "empate", status: "contactado", updatedAt: "2026-09-25T10:00:00.000Z" },
      ],
    };
    const { snapshot } = reconcileOnLoad(local, remoto);
    expect(snapshot.statuses.filter((s) => s.apartmentId === "velho")).toHaveLength(1);
    expect(snapshot.statuses.find((s) => s.apartmentId === "velho")?.status).toBe("descartado");
    expect(snapshot.statuses.find((s) => s.apartmentId === "novo")?.status).toBe("agendado");
    // Empate: o remoto ganha (o dono acabou de escrever no outro aparelho).
    const empate = reconcileOnLoad(
      { ...local, statuses: [{ apartmentId: "empate", status: "visita", updatedAt: "2026-09-25T10:00:00.000Z" }] },
      remoto,
    );
    expect(empate.snapshot.statuses.find((s) => s.apartmentId === "empate")?.status).toBe(
      "contactado",
    );
  });

  it("test_merge_nao_regressa_a_trava_antiapaagao_nem_o_arranque_vazio", () => {
    // As duas regras que já existiam antes do merge e que não podem encolher:
    // (1) aparelho com dado + servidor vazio não adota o vazio (aba anônima que
    // empurrou o dele), e (2) servidor ausente sobe o local.
    const comDado = soLocal();
    const trava = reconcileOnLoad(comDado, emptySnapshot(em("2026-09-28T09:00:00.000Z")));
    expect(trava.adoptedRemote).toBe(false);
    expect(trava.snapshot.userAdded.map((a) => (a as { id: string }).id)).toEqual([MEU.id]);
    const semRemoto = reconcileOnLoad(comDado, null);
    expect(semRemoto.adoptedRemote).toBe(false);
    expect(semRemoto.snapshot).toBe(comDado);
  });
});