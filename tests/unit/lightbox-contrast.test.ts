import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contrastRatio } from "@/lib/contrast";
import {
  APP_PROFILES,
  THEME_CONTRAST_TEXT,
  THEME_CONTRAST_UI,
  THEME_CONTRAST_UI_DUNGEON,
  THEME_FORBIDDEN_PAIRS,
  THEME_FORBIDDEN_PAIRS_DUNGEON,
  THEME_PALETTE,
  THEME_PALETTE_DUNGEON,
  resolveAppProfile,
  themeCssVars,
} from "@/lib/constants";

// Trava AAA dos DOIS temas (DESIGN.md §1 e §1.1).
// Fonte única de verdade: THEME_PALETTE (dono) e THEME_PALETTE_DUNGEON (perfil
// `thais`) em lib/constants.ts (LL-006). Pisos WCAG 2.2: texto normal ≥ 7:1
// (AAA), UI/borda ≥ 3:1. Os dois temas passam pela MESMA lista de pares de
// texto: o que separa claro de escuro é o token `on-accent`, nunca o `ink`.
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
describe("contraste AAA do tema", () => {
  it("test_contraste_helpers_pretobranco_21_para_1", () => {
    // arrange/act/assert: âncoras matemáticas conhecidas (trava a implementação)
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 2);
    // par real medido na fase de plano (dourado sobre navy): trava o cálculo
    expect(contrastRatio("#C8A66B", "#0B1121")).toBeCloseTo(8.17, 1);
  });

  it("test_contraste_texto_normal_todos_acima_7", () => {
    // arrange: pares texto/fundo declarados nas constantes do tema
    // act + assert: cada par precisa bater o piso AAA de texto normal
    expect(THEME_CONTRAST_TEXT.length).toBeGreaterThan(0);
    for (const pair of THEME_CONTRAST_TEXT) {
      const ratio = contrastRatio(
        THEME_PALETTE[pair.fg],
        THEME_PALETTE[pair.bg],
      );
      expect(
        ratio,
        `${pair.label}: ${THEME_PALETTE[pair.fg]} sobre ${THEME_PALETTE[pair.bg]} = ${ratio.toFixed(2)}:1 (piso ${pair.floor}:1)`,
      ).toBeGreaterThanOrEqual(pair.floor);
    }
  });

  it("test_contraste_ui_bordas_todas_acima_3", () => {
    // arrange: pares de UI não-textual (bordas de input, anel de foco)
    // act + assert: piso WCAG 2.2 de componente gráfico (3:1)
    expect(THEME_CONTRAST_UI.length).toBeGreaterThan(0);
    for (const pair of THEME_CONTRAST_UI) {
      const ratio = contrastRatio(
        THEME_PALETTE[pair.fg],
        THEME_PALETTE[pair.bg],
      );
      expect(
        ratio,
        `${pair.label}: ${ratio.toFixed(2)}:1 (piso ${pair.floor}:1)`,
      ).toBeGreaterThanOrEqual(pair.floor);
    }
  });

  it("test_contraste_pares_proibidos_abaixo_do_piso", () => {
    // arrange: pares que o DESIGN.md v2 proíbe (ex.: branco sobre táxi = 1.63:1)
    // act + assert: prova que a proibição é real — o par FALHA o piso de texto
    expect(THEME_FORBIDDEN_PAIRS.length).toBeGreaterThan(0);
    for (const pair of THEME_FORBIDDEN_PAIRS) {
      const ratio = contrastRatio(
        THEME_PALETTE[pair.fg],
        THEME_PALETTE[pair.bg],
      );
      expect(
        ratio,
        `${pair.label}: esperava FALHA (< ${pair.floor}:1), mediu ${ratio.toFixed(2)}:1`,
      ).toBeLessThan(pair.floor);
    }
  });
});

// Perfil `thais` — "Dungeon Quest". Mesma lista de pares de texto, paleta
// invertida: papel é pedra, tinta é pergaminho, e o acento continua sendo a
// única voz clara. Sem o `on-accent` (texto POR CIMA de um acento) o `ink`
// claro cai para 1.75:1 no táxi — que é o bug que estes testes impedem.
describe("contraste AAA do tema dungeon (perfil thais)", () => {
  it("test_paleta_dungeon_contraste_texto_normal_todos_acima_7", () => {
    expect(THEME_CONTRAST_TEXT.length).toBeGreaterThan(0);
    for (const pair of THEME_CONTRAST_TEXT) {
      const ratio = contrastRatio(
        THEME_PALETTE_DUNGEON[pair.fg],
        THEME_PALETTE_DUNGEON[pair.bg],
      );
      expect(
        ratio,
        `${pair.label}: ${THEME_PALETTE_DUNGEON[pair.fg]} sobre ${THEME_PALETTE_DUNGEON[pair.bg]} = ${ratio.toFixed(2)}:1 (piso ${pair.floor}:1)`,
      ).toBeGreaterThanOrEqual(pair.floor);
    }
  });

  it("test_paleta_dungeon_contraste_ui_acima_3", () => {
    // UI da pedra: trilho do slider, hairline do card, thumb do slider.
    expect(THEME_CONTRAST_UI_DUNGEON.length).toBeGreaterThan(0);
    for (const pair of THEME_CONTRAST_UI_DUNGEON) {
      const ratio = contrastRatio(
        THEME_PALETTE_DUNGEON[pair.fg],
        THEME_PALETTE_DUNGEON[pair.bg],
      );
      expect(
        ratio,
        `${pair.label}: ${THEME_PALETTE_DUNGEON[pair.fg]} sobre ${THEME_PALETTE_DUNGEON[pair.bg]} = ${ratio.toFixed(2)}:1 (piso ${pair.floor}:1)`,
      ).toBeGreaterThanOrEqual(pair.floor);
    }
  });

  it("test_paleta_dungeon_ink_sobre_acento_abaixo_do_piso", () => {
    // O `ink` é a tinta do TEMA: ele nunca pode ser o texto de um acento
    // (é o que o `on-accent` substitui). Se alguém "resolver" um texto
    // ilegível trocando `on-accent` por `ink`, esta lista acusa.
    expect(THEME_FORBIDDEN_PAIRS_DUNGEON.length).toBeGreaterThan(0);
    for (const pair of THEME_FORBIDDEN_PAIRS_DUNGEON) {
      const ratio = contrastRatio(
        THEME_PALETTE_DUNGEON[pair.fg],
        THEME_PALETTE_DUNGEON[pair.bg],
      );
      expect(
        ratio,
        `${pair.label}: esperava FALHA (< ${pair.floor}:1), mediu ${ratio.toFixed(2)}:1`,
      ).toBeLessThan(pair.floor);
    }
  });

  it("test_paleta_dungeon_mesmos_nomes_de_token_do_tema_claro", () => {
    // 504 classes utilitárias (`bg-paper`, `text-ink`, `border-line`…) e
    // globals.css consomem esses NOMES. Renomear um token no tema escuro
    // quebraria a classe sem erro de tipo — por isso a trava.
    expect(Object.keys(THEME_PALETTE_DUNGEON).sort()).toEqual(
      Object.keys(THEME_PALETTE).sort(),
    );
  });

  it("test_paleta_dungeon_todo_token_diferente_do_tema_claro", () => {
    // Isolamento de verdade: a dungeon é outro tema, não uma cópia com poucos
    // tons trocados. `night` é a ÚNICA exceção — é o scrim de foto, escuro nos
    // dois (mesmo azul-noite do app/icon.svg, DESIGN.md §1).
    const iguais = Object.keys(THEME_PALETTE).filter(
      (token) =>
        token !== "night" &&
        THEME_PALETTE_DUNGEON[token as keyof typeof THEME_PALETTE_DUNGEON] ===
          THEME_PALETTE[token as keyof typeof THEME_PALETTE],
    );
    expect(iguais, `tokens idênticos ao tema claro: ${iguais.join(", ")}`).toEqual(
      [],
    );
  });
});

// O CSS é a parte que o teste de contraste não alcança: ele valida pares de
// token, não o que a folha de estilo faz com eles. Estas três travas cobrem a
// ponte CSS <-> constantes, que é onde a paleta escura poderia vazar para o
// build do dono sem nenhum teste de cor falhar.
describe("tema por perfil: ponte CSS e constantes", () => {
  const css = readFileSync(join("app", "globals.css"), "utf8");

  it("test_globals_theme_bate_com_a_paleta_do_dono", () => {
    // O bloco @theme É a paleta do dono, token a token. Qualquer edição de cor
    // em globals.css que não passe por THEME_PALETTE quebra aqui.
    for (const [token, hex] of Object.entries(THEME_PALETTE)) {
      expect(
        css.includes(`--color-${token}: ${hex};`),
        `@theme sem --color-${token}: ${hex} (THEME_PALETTE)`,
      ).toBe(true);
    }
  });

  it("test_globals_theme_nao_contem_hex_da_dungeon", () => {
    // Gate de isolamento: nenhum hex exclusivo da dungeon pode estar no CSS
    // compartilhado, senão o build do `dono` carrega a paleta do outro cliente.
    const exclusivos = Object.entries(THEME_PALETTE_DUNGEON).filter(
      ([token, hex]) =>
        token !== "night" && hex !== THEME_PALETTE[token as keyof typeof THEME_PALETTE],
    );
    const vazamentos = exclusivos
      .filter(([token, hex]) => css.includes(`--color-${token}: ${hex};`))
      .map(([token]) => token);
    expect(vazamentos, `hex da dungeon em globals.css: ${vazamentos.join(", ")}`).toEqual(
      [],
    );
  });

  it("test_globals_overrides_da_dungeon_todo_escopado_no_perfil_thais", () => {
    // §1.1: as regras que a tinta clara quebraria precisam estar dentro de
    // [data-perfil="thais"]. Este teste só garante que o gancho existe e cobre
    // os dois pares que quebram sem ele — texto sobre acento e texto sobre o
    // scrim de foto. A lista de classes é conferida pelo grep de QC.
    expect(css).toContain('[data-perfil="thais"]');
    expect(css).toMatch(
      /\[data-perfil="thais"\][^{]*\.bg-taxi[^{]*\{[^}]*var\(--color-on-accent\)/,
    );
    expect(css).toMatch(
      /\[data-perfil="thais"\][^{]*\[class\*="bg-night"\][^{]*\{[^}]*--color-paper:\s*var\(--color-ink\)/,
    );
  });

  it("test_theme_css_vars_serializa_todos_os_tokens_da_paleta", () => {
    // O que o layout.tsx põe no atributo style do <html> precisa cobrir a
    // paleta inteira: token faltando = classe utilitária resolvendo para o
    // tom do tema do dono dentro do app escuro. (Precisa ser MAPA, não string:
    // `style` do React só aceita objeto.)
    const style = themeCssVars(THEME_PALETTE_DUNGEON);
    expect(Object.keys(style).sort()).toEqual(
      Object.keys(THEME_PALETTE_DUNGEON)
        .map((token) => `--color-${token}`)
        .sort(),
    );
    expect(style["--color-paper"]).toBe(THEME_PALETTE_DUNGEON.paper);
    expect(style["--color-on-accent"]).toBe(
      THEME_PALETTE_DUNGEON["on-accent"],
    );
  });

  it("test_resolve_app_profile_default_dono_e_thais_por_env", () => {
    expect(resolveAppProfile({})).toBe("dono");
    expect(resolveAppProfile({ NEXT_PUBLIC_PERFIL: "thais" })).toBe("thais");
    expect(resolveAppProfile({ NEXT_PUBLIC_BASE_ARQUIVO: "thais" })).toBe("thais");
  });

  it("test_identidade_por_perfil_nao_compartilha_nome_nem_descricao", () => {
    // Dois clientes isolados: se o nome ou a descrição do `thais` mentionar o
    // app do `dono`, o build dele publica a marca errada no title/OG.
    const thais = APP_PROFILES.thais;
    expect(thais.appName).toBe("Dungeon Quest Igor e Thaís Tales");
    for (const campo of [
      thais.appTitle,
      thais.appDescription,
      thais.ogDescription,
    ]) {
      expect(campo.toLowerCase()).not.toContain("lagoscrib");
      expect(campo.toLowerCase()).not.toContain("apartamento");
    }
    expect(APP_PROFILES.dono.appName).toBe("Lagoscrib");
  });
});