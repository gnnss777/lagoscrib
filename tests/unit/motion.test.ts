import { describe, expect, it } from "vitest";
import { cardStaggerDelay } from "@/lib/motion";

// Polimento UX v2 — F1.3 (stagger cap): lista longa não pode deixar os últimos
// cards sumirem por segundos. Delay = min(index, cap) * step.
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].

describe("cardStaggerDelay (F1.3)", () => {
  it("test_stagger_delay_cresce_por_passo_ate_o_cap", () => {
    // arrange/act: 20 cards, step 0.08, cap 12
    const values = [0, 5, 12, 20].map((i) => cardStaggerDelay(i, 0.08, 12));
    // assert: delay = min(index, cap) * step
    expect(values).toEqual([
      0, // index 0
      0.4, // 5 * 0.08
      0.96, // 12 * 0.08 (no cap)
      0.96, // 20 → capado em 12 → 0.96 (não 1.6)
    ]);
  });

  it("test_stagger_delay_capa_todos_alem_do_cap_no_mesmo_tempo", () => {
    // arrange/act: índices 12 e 40 com cap 12
    // assert: mesmo delay — o 40º card não espera os 39 primeiros
    expect(cardStaggerDelay(12, 0.08, 12)).toBe(
      cardStaggerDelay(40, 0.08, 12),
    );
  });

  it("test_stagger_delay_indice_negativo_clampa_em_zero", () => {
    // arrange/act: índice -3 (não deveria existir; defesa)
    // assert: delay 0, sem NaN/infinito
    expect(cardStaggerDelay(-3, 0.08, 12)).toBe(0);
  });

  it("test_stagger_delay_sem_cap_nao_limita_crescimento", () => {
    // arrange/act: step 0.05 com índices altos e cap 0/indefinido
    // assert: sem cap, delay cresce linearmente (comportamento legado)
    expect(cardStaggerDelay(50, 0.05)).toBe(2.5);
    expect(cardStaggerDelay(50, 0.05, 0)).toBe(2.5 * 0); // cap 0 → delay 0
  });

  it("test_stagger_delay_handles_entradas_invalidas", () => {
    // arrange/act: step 0 ou index não-inteiro
    // assert: step 0 → delay sempre 0; decimal de index é truncado
    expect(cardStaggerDelay(7, 0, 12)).toBe(0);
    expect(cardStaggerDelay(5.9, 0.08, 12)).toBe(0.4);
  });
});
