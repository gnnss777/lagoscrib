import { describe, expect, it } from "vitest";
import { ehTelefoneValido } from "@/lib/phone";

// Substitui o antigo phone-gate.test.ts, que cobria isBusinessHours e maskPhone
// (ambos removidos: telefone de imobiliária é público, sem janela comercial).
// O que fica é o validador de formato, que é a rede contra o coletor gravar lixo
// no lugar do número.
describe("telefone", () => {
  it("test_phone_aceita_celular_e_fixo_em_e164", () => {
    expect(ehTelefoneValido("+5541996990773")).toBe(true); // celular: 11 dígitos, nono = 9
    expect(ehTelefoneValido("+554131213565")).toBe(true); // fixo: 10 dígitos
  });

  it("test_phone_rejeita_formato_que_nao_e_e164", () => {
    expect(ehTelefoneValido("")).toBe(false);
    expect(ehTelefoneValido(undefined)).toBe(false);
    expect(ehTelefoneValido(null)).toBe(false);
    expect(ehTelefoneValido("(41) 99850-1542")).toBe(false); // sem +55
    expect(ehTelefoneValido("+5541991")).toBe(false); // curto demais
    expect(ehTelefoneValido("+554199999999999")).toBe(false); // longo demais
  });

  it("test_phone_so_10_digitos_apos_o_55_e_fixo_e_passa", () => {
    // A regra real: 10 dígitos depois do +55 = fixo, e o nono dígito não é
    // critério. Só os 11 dígitos exigem nono = 9.
    expect(ehTelefoneValido("+554131213565")).toBe(true);
    expect(ehTelefoneValido("+552913835418")).toBe(true); // id de anúncio, 10 dígitos
  });

  it("test_phone_11_digitos_so_passa_com_nono_nove", () => {
    expect(ehTelefoneValido("+5541996990773")).toBe(true); // 11 dígitos, nono = 9
    expect(ehTelefoneValido("+5541812345678")).toBe(false); // 11 dígitos, nono = 8
  });
});
