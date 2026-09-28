import { describe, expect, it } from "vitest";
import { telApolar, telefonesDeHrefs } from "@/scripts/coleta/telefone.mjs";

// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
//
// Estes testes existem porque o coletor já falhou uma vez em silêncio: o ADR-001
// §5 assumiu "portais mascaram" e a base ficou meses com 64 imóveis e zero
// telefone, sem nada no repo reclamar (postmortem ERRO-2).
describe("telefone da coleta", () => {
  it("test_telefone_celular_classifica_por_tamanho_depois_do_55", () => {
    // Números reais pegados do Zap em 27/09/2026 (id 2913835418, Água Verde).
    const t = telefonesDeHrefs(["tel:+554131213565", "tel:+5541996990773"]);
    expect(t.celular).toBe("+5541996990773");
    expect(t.fixo).toBe("+554131213565");
    expect(t.phone).toBe("+5541996990773"); // celular tem prioridade
  });

  it("test_telefone_55_nao_confunde_celular_com_fixo", () => {
    // A armadilha: medir o comprimento ANTES de tirar o 55 dá 12/11 em vez de
    // 10/11 e o celular cai na regra do fixo. Cada caso abaixo é o mesmo
    // número, medido do jeito certo e do jeito errado.
    const soCelular = telefonesDeHrefs(["tel:+5541996990773"]);
    expect(soCelular.celular).toBe("+5541996990773");
    expect(soCelular.fixo).toBe("");

    const soFixo = telefonesDeHrefs(["tel:+554131213565"]);
    expect(soFixo.fixo).toBe("+554131213565");
    expect(soFixo.celular).toBe("");
  });

  it("test_telefone_so_fixo_ainda_vira_phone", () => {
    const t = telefonesDeHrefs(["tel:+554131213565"]);
    expect(t.phone).toBe("+554131213565");
  });

  it("test_telefone_descarta_lixo_curto", () => {
    expect(telefonesDeHrefs(["tel:12345"])).toEqual({ phone: "", celular: "", fixo: "" });
    expect(telefonesDeHrefs(["tel:"])).toEqual({ phone: "", celular: "", fixo: "" });
    expect(telefonesDeHrefs([])).toEqual({ phone: "", celular: "", fixo: "" });
    expect(telefonesDeHrefs(undefined)).toEqual({ phone: "", celular: "", fixo: "" });
  });

  it("test_telefone_id_de_anuncio_so_nao_e_ameaca_vindo_de_tel_href", () => {
    // O id do anúncio no Zap é "2913835418". Ele NÃO entra na base: a função
    // só lê `a[href^="tel:"]`, e o id vive no path da URL
    // (...-48m2-id-2913835418/). Nada o transforma em `tel:`.
    //
    // Não se apoie no tamanho para se defender disso: com o prefixo 55 o id
    // vira 12 dígitos e casa com a regra de fixo, como este teste mostra. O
    // comprimento DDD+número NÃO rejeita id — quem rejeita é o seletor. Se um
    // dia alguém passar a varrer texto em vez de `tel:`, este teste quebra, e
    // é para quebrar.
    expect(telefonesDeHrefs(["tel:+552913835418"]).fixo).toBe("+552913835418");
    // No formato real em que o id aparece (path, não tel:), nada é extraído:
    expect(telefonesDeHrefs(["https://zapimoveis.com.br/imovel/x-48m2-id-2913835418/"])).toEqual({
      phone: "",
      celular: "",
      fixo: "",
    });
  });

  it("test_telefone_apolar_normaliza_nacional_para_e164", () => {
    // A API do Apolar devolve SEM o 55. Formato real: "(41)99121-0624".
    expect(telApolar("(41)99121-0624")).toBe("+5541991210624");
    expect(telApolar("(41) 3542 - 1322")).toBe("+554135421322");
    // Já com 55 continua válido (a API pode mudar).
    expect(telApolar("+5541991210624")).toBe("+5541991210624");
  });

  it("test_telefone_apolar_vazio_e_lixo", () => {
    for (const v of ["", null, undefined, "n/a", "-", "0"]) {
      expect(telApolar(v), String(v)).toBe("");
    }
  });

  it("test_telefone_apolar_aceita_a_mesma_funcao_do_zap", () => {
    // Fecha o circuito: o que o Apolar entrega, depois de telApolar, tem que
    // passar pela mesma classificação do Zap. É isso que impede o WhatsApp de
    // cair no fallback por causa do formato.
    const daApi = telApolar("(41)99121-0624");
    const t = telefonesDeHrefs([`tel:${daApi}`]);
    expect(t.celular).toBe("+5541991210624");
  });
});
