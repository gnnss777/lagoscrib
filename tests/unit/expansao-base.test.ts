import { describe, expect, it } from "vitest";
import { apartments, saleApartments } from "@/lib/data";
import { TETO_TOTAL_ALUGUEL } from "@/lib/constants";
import { totalAllIn } from "@/lib/pricing";
import { ehTelefoneValido } from "@/lib/phone";

// Expansão da base (5 fontes, 22/09/2026): invariantes de toda a base,
// originais + novos. Regras: sem contato, link verbatim, total consistente,
// fotos locais, verifiedAt, ids únicos, combos cobertos.
describe("expansao base", () => {
  const all = [...apartments, ...saleApartments];

  it("test_expansao_telefone_valido_quando_publicado", () => {
    // O assert antigo era `expect(a.phone).toBe("")` — travava a base inteira
    // no vazio por causa do ADR-001 §5, que assumiu que os portais mascaram o
    // número. Estava errado: o número aparece no Zap/VivaReal depois do clique
    // em "mostrar telefone" e vem no campo lojacelular da API do Apolar
    // (ADR-004). Vazio continua válido — imóvel sem telefone publicado é
    // legítimo — mas o que EXISTE tem que ser um número brasileiro de verdade.
    // Sem este check, um coletor quebrado grava lixo e o app exibe lixo.
    for (const a of all) {
      if (a.phone) expect(ehTelefoneValido(a.phone), `${a.id} phone=${a.phone}`).toBe(true);
    }
  });

  it("test_expansao_sem_email", () => {
    // Nenhum dos 4 portais publica e-mail do anunciante no payload que o
    // coletor lê. Segue vazio por decisão, não por esquecimento.
    for (const a of all) {
      expect(a.email, a.id).toBe("");
    }
  });

  it("test_expansao_tem_telefone_na_base", () => {
    // Trava contra a regressão que o ADR-001 §5 produziu: 64 imóveis, todos
    // com phone vazio, e nada no repo reclamando. Se a base inteira voltar a
    // zero telefone, o coletor quebrou (ou rodou sem --cdp=) e este teste
    // falha. Erro explícito, não `[]` silencioso (postmortem ERRO-2).
    const comTel = all.filter((a) => a.phone).length;
    expect(comTel, "nenhum imóvel tem telefone — rode a coleta com --cdp=").toBeGreaterThan(0);
  });

  it("test_expansao_links_verbatim_por_fonte", () => {
    // Portais ativos na leva 4. Apolar entra com a URL do anúncio
    // (/alugar/apartamento/...), não mais com ?ref= da home.
      const domains = [
        "zapimoveis.com.br/imovel/",
        "vivareal.com.br/imovel/",
        "olx.com.br",
        "apolar.com.br/",
        // 5a fonte: import por link (S011). Entra com a URL do anúncio.
        "chavesnamao.com.br/imovel/",
      ];
    for (const a of all) {
      expect(domains.some((d) => a.link.includes(d))).toBe(true);
    }
  });

  it("test_expansao_totais_consistentes", () => {
    for (const a of all) {
      expect(totalAllIn(a)).toBe(a.total);
      if (a.transaction === "venda") {
        expect(a.salePrice).toBeGreaterThan(0);
        expect(a.total).toBe(a.salePrice);
        expect(a.rent).toBe(0);
      } else {
        expect(a.total).toBe(a.rent + a.condo + a.iptu);
      }
    }
  });

  it("test_expansao_fotos_locais", () => {
    for (const a of all) {
      expect(a.image).toMatch(/^\/imoveis\/.+\.webp$/);
      expect(a.photos?.length).toBeGreaterThanOrEqual(1);
      expect(a.photos?.[0]?.src).toBe(a.image);
    }
  });

  it("test_expansao_verifiedAt_presente", () => {
    for (const a of all) {
      expect(a.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("test_expansao_ids_unicos", () => {
    const ids = all.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("test_expansao_combos_cobertos", () => {
    // Leva 4 (27/09/2026): coleta dirigida para 2-3 quartos (--quartos=2,3) com
    // teto de R$ 3.000 (--preco-max=3000). As faixas de 1 e 4+ ficam vazias por
    // decisão — o filtro mostra "1 quarto · 0". A base de venda está vazia.
    const pool = all.filter((a) => a.transaction !== "venda");
    for (const b of [2, 3]) {
      const n = pool.filter((a) => a.bedrooms === b).length;
      expect(n, `faixa ${b} quartos`).toBeGreaterThan(0);
    }
  });

  it("test_expansao_dentro_do_escopo_da_leva", () => {
    // Trava o critério da coleta: 2-3 quartos e R$ 3.500 com TODAS as taxas.
    // O teto é no all-in (aluguel + condomínio + IPTU), não no aluguel: o filtro
    // de busca dos portais é por aluguel (--preco-max), então travar só o
    // aluguel deixaria passar imóvel de R$ 2.500 com R$ 1.300 de condomínio.
    // Sem isso uma leva futura muda o produto em silêncio.
    // Ver docs/stories/S010-coleta-teto-allin-3500.md.
    for (const a of all) {
      expect([2, 3], `${a.id} quartos`).toContain(a.bedrooms);
      expect(a.total, `${a.id} all-in`).toBeLessThanOrEqual(TETO_TOTAL_ALUGUEL);
    }
  });
});
