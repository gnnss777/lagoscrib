import { describe, expect, it } from "vitest";
import { extrairDoAnuncio, bairroNoTexto, num, money } from "@/lib/imovel-import";

// HTML real do Chaves na Mão, cortado no que o parser usa. O portal entrega o
// Product aninhado (não no topo do ld+json), escreve "Sem taxa de condomínio"
// em vez de omitir, e esconde a área atrás de um skeleton loader.
const CHAVES_NA_MAO = `
<html><head>
<meta property="og:title" content="Apartamento com 3 quartos na Rua Coronel Dulcídio, 357, Batel, Curitiba - PR">
<meta property="og:description" content="Alugar Apartamento na Rua coronel dulcídio, 357, Batel em Curitiba por R$ 3500 com 3 quartos e com 104m². Falar com SAGLE IMOVEIS, ref: do imóvel: 357.">
<script type="application/ld+json">
{"@type":"Organization","name":"Chaves na Mao","about":{"@type":"Product","description":"Apartamento amplo de com três dormitórios, área de serviço cozinha com móveis planejados. Mobiliado Sem vaga de garagem Valor do aluguel R$3500 Sem taxa de condomínio Valor do IPTU R$98","priceCurrency":"BRL"}}
</script>
</head><body>
<p>Apartamento com 3 quartos e 2 banheiros, 1 vaga</p>
<p>Valor do aluguel R$3500 Sem taxa de condomínio Valor do IPTU R$98</p>
<img src="https://www.chavesnamao.com.br/imn/0850x0450/N/60/imoveis/920817/46288817/foto1">
<img src="https://www.chavesnamao.com.br/imn/0640x0400/N/60/imoveis/920817/46288817/foto2">
<img src="https://cdn.chavesnamao.com.br/portal/static/images/icons/icon-192x192.png">
</body></html>`;

const URL =
  "https://www.chavesnamao.com.br/imovel/apartamento-para-alugar-3-quartos-pr-curitiba-batel-110m2-RS3500/id-46288817/";

describe("import por link", () => {
  it("test_import_num_interpreta_ponto_e_virgula_ptbr", () => {
    expect(num("1.234")).toBe(1234);
    expect(num("45.5")).toBe(46);
    expect(num("1.234,56")).toBe(1235);
    expect(num("R$ 3.500")).toBe(3500);
    expect(num("")).toBe(0);
  });

  it("test_import_money_pega_o_primeiro_reais", () => {
    expect(money("Valor do aluguel R$3500")).toBe(3500);
    expect(money("IPTU R$98")).toBe(98);
    expect(money("sem preço")).toBe(0);
  });

  it("test_import_bairro_escolhe_o_nome_mais_longo_entre_sobrepostos", () => {
    // "Santa Quitéria" e "Quitéria" estão as duas na lista e a segunda é
    // sufixo da primeira: o casamento tem que devolver a oficial mais longa.
    expect(bairroNoTexto("Rua X, Santa Quitéria, Curitiba")).toBe("Santa Quitéria");
    expect(bairroNoTexto("Bigorrilho, Curitiba - PR")).toBe("Bigorrilho");
    // Devolve o nome oficial, com acento, mesmo se o texto vier sem ele.
    expect(bairroNoTexto("agua verde")).toBe("Água Verde");
  });

  it("test_import_extrai_valores_do_chavesnamao", () => {
    const r = extrairDoAnuncio(CHAVES_NA_MAO, URL);
    expect(r.rent).toBe(3500);
    expect(r.iptu).toBe(98);
    // "Sem taxa de condomínio" é 0 DECLARADO, não desconhecido: a diferença
    // importa porque condomínio inventado quebra o total all-in.
    expect(r.condo).toBe(0);
    expect(r.condoUnknown).toBe(false);
    expect(r.bedrooms).toBe(3);
    expect(r.bathrooms).toBe(2);
    expect(r.neighborhood).toBe("Batel");
    // Endereço vem do og:title: no texto corrido o nome da rua saía truncado
    // ("Rua Cor"), porque a vírgula do número corta a classe de caracteres.
    expect(r.address).toBe("Rua Coronel Dulcídio, 357");
    // O all-in deste anúncio é R$ 3.598 — é o que subiu o teto para 3.600.
    expect(r.rent + r.condo + r.iptu).toBe(3598);
  });

  it("test_import_area_vem_da_url_e_avisa_que_a_pagina_nao_mostra", () => {
    const r = extrairDoAnuncio(CHAVES_NA_MAO, URL);
    // A área está atrás de skeleton loader; o og:description diz 104m² mas o
    // texto visível não traz m², então o parser usa os 110m² da URL e avisa.
    expect(r.area).toBe(110);
    expect(r.areaFrom).toBe("url");
    expect(r.avisos.join(" ")).toContain("área veio da URL");
  });

  it("test_import_reescreve_a_grade_das_fotos_para_passar_na_regra", () => {
    const r = extrairDoAnuncio(CHAVES_NA_MAO, URL);
    // 850x450 reprova na regra do app (lado menor >= 500px); o CDN aceita a
    // grade no path e já serve WebP, então só reescreve o segmento.
    for (const f of r.photoUrls) expect(f).toContain("/imn/1280x0853/");
    // Ícone do portal não é foto do imóvel.
    expect(r.photoUrls.some((f) => /icon-192/.test(f))).toBe(false);
  });

  it("test_import_avisa_campo_nao_dito_em_vez_de_inventar", () => {
    const r = extrairDoAnuncio("<html><body><p>apartamento</p></body></html>", "https://exemplo.com/x");
    expect(r.neighborhood).toBe("");
    expect(r.rent).toBe(0);
    expect(r.avisos.length).toBeGreaterThan(0);
    // Nada de valor inventado: zero é "não informado", e os avisos dizem isso.
    expect(r.condo).toBe(0);
    expect(r.condoUnknown).toBe(true);
  });
});
