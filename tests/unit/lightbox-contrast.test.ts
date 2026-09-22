import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/contrast";
import {
  THEME_CONTRAST_TEXT,
  THEME_CONTRAST_UI,
  THEME_FORBIDDEN_PAIRS,
  THEME_PALETTE,
} from "@/lib/constants";

// Trava AAA do tema "Lightbox Analógico" (DESIGN.md v2 §cores).
// Fonte única de verdade: THEME_PALETTE em lib/constants.ts (LL-006).
// Pisos WCAG 2.2: texto normal ≥ 7:1 (AAA), UI/borda ≥ 3:1.
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
