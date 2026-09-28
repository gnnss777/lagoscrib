import { describe, expect, it } from "vitest";
import {
  ehCelular,
  ehDoDdd,
  ehFixo,
  leadConfigurado,
  telApolar,
  telefonesDeHrefs,
} from "@/scripts/coleta/telefone.mjs";

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

// A validação é o que impede número errado no app. O campo vem LIDO À MÃO do
// site da imobiliária, e a revisão achou dois casos que vinham rotulados como
// celular e eram fixo de 8 dígitos.
describe("validacao de celular e fixo", () => {
  it("test_valida_celular_so_com_nono_digito_nove", () => {
    // Celulares reais lidos nos sites das imobiliárias
    for (const ok of ["+5541996690773", "+5541985150317", "+5541987010407", "+5541988592464"])
      expect(ehCelular(ok), ok).toBe(true);
    // 8 dígitos, mesmo começando com 9: é número curto de fixo, não celular.
    // Estes dois vieram rotulados como celular na revisão e foram barrados.
    expect(ehCelular("+554195740407")).toBe(false); // Basi "41 9574-0407"
    expect(ehCelular("+554199960927")).toBe(false); // Nakayoshi "41 9996-0927"
  });

  it("test_valida_fixo_com_8_digitos", () => {
    expect(ehFixo("+554132336025")).toBe(true); // Paraíso
    expect(ehFixo("+554132502000")).toBe(true); // 2000
    expect(ehFixo("+5541996690773")).toBe(false); // celular não é fixo
  });

  it("test_valida_rejeita_tudo_que_nao_e_e164_brasil", () => {
    // Aqui só o formato. DDD é outra checagem (ehDoDdd) — um celular de São
    // Paulo é E.164 válido, só não é da região que o dono pediu.
    for (const ruim of [
      "",
      null,
      undefined,
      "+55419996092700", // 14 dígitos: um a mais
      "+5541", // curto demais
      "41996690773", // sem +55
      "+554199669077", // 9 dígitos
      "0800 241 1234", // toll-free
      "(41) 99699-0773", // com máscara
      "+1 415 555 0100", // número dos EUA
    ])
      expect(ehCelular(ruim), String(ruim)).toBe(false);
  });

  it("test_celular_de_fora_da_regiao_e_valido_mas_nao_serve", () => {
    // DDD 31 (São Paulo) e DDD 11 (Rio) são E.164 legítimos...
    expect(ehCelular("+5531996690773")).toBe(true);
    expect(ehCelular("+5511996690773")).toBe(true);
    // ...mas não são da região Curitiba que o dono pediu.
    expect(ehDoDdd("+5531996690773")).toBe(false);
    expect(ehDoDdd("+5511996690773")).toBe(false);
  });

  it("test_valida_ddd_da_regiao_curitiba", () => {
    expect(ehDoDdd("+5541996690773")).toBe(true);
    expect(ehDoDdd("+554132336025")).toBe(true);
    expect(ehDoDdd("+5531996690773")).toBe(false);
    expect(ehDoDdd("+5511996690773")).toBe(false);
    expect(ehDoDdd(null)).toBe(false);
  });
});

// O formulário de lead envia dados pessoais do dono para CADA anunciante. A
// trava é dupla de propósito: flag explícita E variáveis preenchidas. Se um dia
// alguém preencher o env e esquecer a flag, o backfill ainda não envia nada.
describe("lead de formulario", () => {
  const completo = { LEAD_NOME: "Fulano", LEAD_TELEFONE: "+5541999999999", LEAD_EMAIL: "a@b.com" };

  it("test_lead_exige_flag_e_dados", () => {
    expect(leadConfigurado({}).habilitado).toBe(false);
    expect(leadConfigurado({ ...completo }).habilitado).toBe(false);
    expect(leadConfigurado({ ...completo, LEAD_ENABLED: "true" })).toMatchObject({
      habilitado: true,
      completo: true,
    });
  });

  it("test_lead_flag_true_sem_dados_nao_ativa", () => {
    // A combinação perigosa: flag ligada, mas falta um campo. Não ativa.
    const r = leadConfigurado({ LEAD_ENABLED: "true", LEAD_NOME: "Fulano", LEAD_EMAIL: "a@b.com" });
    expect(r.habilitado).toBe(true);
    expect(r.completo).toBe(false);
  });

  it("test_lead_flag_aceita_caixa_alta", () => {
    expect(leadConfigurado({ ...completo, LEAD_ENABLED: "TRUE" }).habilitado).toBe(true);
  });

  it("test_lead_flag_false_explicito_nao_ativa", () => {
    expect(leadConfigurado({ ...completo, LEAD_ENABLED: "false" }).habilitado).toBe(false);
    expect(leadConfigurado({ ...completo, LEAD_ENABLED: "1" }).habilitado).toBe(false);
  });
});
