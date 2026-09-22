import { describe, expect, it } from "vitest";
import {
  buildChecklistText,
  buildEntryEstimate,
  buildMovelCost,
  buildWhatsAppConfirm,
  buildWhatsAppLink,
} from "@/lib/antiDores";

// TDD S004 (RED→GREEN): lógica pura anti-dores antes de tocar a UI.
// Valores/faixas vivem em lib/constants.ts (LL-006) — aqui só o comportamento.
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
describe("antiDores", () => {
  const base = {
    id: "zap-aguaverde-raul-90",
    title: "Apartamento com 3 Quartos - Água Verde",
    neighborhood: "Água Verde",
    rent: 2500,
    condo: 580,
    iptu: 140,
    total: 3220,
    link: "https://www.zapimoveis.com.br/imovel/x-id-2912831367/",
  };

  it("test_whatsappconfirma_mensagem_contem_4_perguntas", () => {
    const msg = buildWhatsAppConfirm(base);
    expect(msg).toContain("disponível");
    expect(msg).toMatch(/condomínio/i);
    expect(msg).toMatch(/pet/i);
    expect(msg).toMatch(/fiador/i);
    expect(msg).toContain(base.title);
    expect(msg).toContain(base.link);
  });

  it("test_whatsappconfirma_condesconhecido_diz_aconfirmar", () => {
    const msg = buildWhatsAppConfirm({ ...base, condo: 0, condoUnknown: true });
    expect(msg).toMatch(/a confirmar/i);
  });

  it("test_whatsapplink_mensagem_codificada_sem_numero_inventado", () => {
    // Telefones mascarados nos portais: wa.me de compartilhamento (sem número).
    const url = buildWhatsAppLink("Olá! Disponível?");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("Olá! Disponível?");
  });

  it("test_movelcusto_3quartos_faixa_1000_1800", () => {
    expect(buildMovelCost(3)).toEqual({ min: 1000, max: 1800 });
  });

  it("test_movelcusto_1quarto_faixa_menor", () => {
    const { min, max } = buildMovelCost(1);
    expect(min).toBeLessThan(1000);
    expect(max).toBeLessThanOrEqual(1000);
    expect(min).toBeLessThan(max);
  });

  it("test_entradaestimada_aluguel_faixa_1x_a_4x", () => {
    // 1º mês (fiador, sem custo) até caução 3× + 1º mês.
    expect(buildEntryEstimate({ rent: 2500 })).toEqual({ min: 2500, max: 10000 });
  });

  it("test_checklisttext_marcados_com_nome_e_valores", () => {
    const text = buildChecklistText(
      { ...base, total: 3220 },
      ["pressao-agua", "infiltracao"],
      ["pressao-agua", "infiltracao", "tomadas"]
    );
    expect(text).toContain(base.title);
    expect(text).toContain("3.220");
    expect(text).toContain(base.link);
    expect(text).toMatch(/pressao|água/i);
  });
});
