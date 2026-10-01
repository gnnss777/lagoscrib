// Filtro de plataforma/origem no painel de filtros da lista.
//
// A pergunta real do usuário: "de onde veio esse imóvel?". Sem isso, um anúncio
// do Zap e um do Chaves na Mão aparecem iguais e não dá pra confiar na
// procedência nem limpar a base quando um portal degrada.
//
// Regra do núcleo (lib/filters.ts): dado ausente NUNCA exclui. Mas aqui a
// ausência é o contrário — a plataforma é a própria identidade do registro. Um
// imóvel sem `source` não é "de todas as plataformas": é um grupo próprio,
// "sem origem", igual ao que o kanban já faz. Tratar como "todas" esconderia
// exatamente o que o filtro existe para mostrar.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  applyFilters,
  countActiveFilters,
  sourceOf,
} from "@/lib/filters";

const imovel = (patch: Partial<Parameters<typeof applyFilters>[0][number]>) =>
  ({
    id: "x",
    title: "Casa",
    neighborhood: "Batel",
    rent: 3000,
    condo: 0,
    iptu: 0,
    total: 3000,
    area: 120,
    bedrooms: 3,
    ...patch,
  }) as Parameters<typeof applyFilters>[0][number];

const lista = [
  imovel({ id: "1", source: "ZAP Imóveis · AP1936" }),
  imovel({ id: "2", source: "VivaReal · 0100L" }),
  imovel({ id: "3", source: "Chaves na Mão · CIBRACO · CRECI J00020" }),
  imovel({ id: "4", source: "" }),
  imovel({ id: "5" }),
];

describe("origem da plataforma (source)", () => {
  it("test_source_vazio_ou_ausente_vira_o_grupo_sem_origem", () => {
    expect(sourceOf(lista[3])).toBe("sem origem");
    expect(sourceOf(lista[4])).toBe("sem origem");
    expect(sourceOf(lista[0])).toBe("ZAP Imóveis");
  });

  it("test_filtra_pela_plataforma_e_nao_pelo_anunciante", () => {
    // A base do dono tem 105 valores de `source` em 152 imóveis, porque o campo
    // embute imobiliária e CRECI. Se o filtro pegasse o texto inteiro, o painel
    // renderizaria 105 chips. A plataforma é o que reduz.
    expect(sourceOf({ source: "Zap Imóveis · Vila" })).toBe("Zap Imóveis");
    expect(sourceOf({ source: "Chaves na Mão · QUINTOANDAR" })).toBe("Chaves na Mão");
    expect(sourceOf({ source: "Apolar · LocaAção" })).toBe("Apolar");
  });

  it("test_filtra_so_pela_plataforma_marcada", () => {
    const r = applyFilters(lista, { ...DEFAULT_FILTERS, sources: ["ZAP Imóveis"] });
    expect(r.map((a) => a.id)).toEqual(["1"]);
  });

  it("test_marcacao_multipla_e_ou_nao_e", () => {
    const r = applyFilters(lista, {
      ...DEFAULT_FILTERS,
      sources: ["ZAP Imóveis", "VivaReal"],
    });
    expect(r.map((a) => a.id).sort()).toEqual(["1", "2"]);
  });

  it("test_vazio_traz_tudo", () => {
    expect(applyFilters(lista, { ...DEFAULT_FILTERS, sources: [] })).toHaveLength(5);
  });

  it("test_sem_origem_e_grupo_que_da_para_filtrar", () => {
    const r = applyFilters(lista, { ...DEFAULT_FILTERS, sources: ["sem origem"] });
    expect(r.map((a) => a.id).sort()).toEqual(["4", "5"]);
  });

  it("test_filtros_continuam_sendo_e_entre_grupos", () => {
    // origem não pode Narrowing sozinha: platforma E bairro têm de valer juntos
    const r = applyFilters(lista, {
      ...DEFAULT_FILTERS,
      sources: ["ZAP Imóveis"],
      neighborhood: "Batel",
    });
    expect(r).toHaveLength(1);
    const r2 = applyFilters(lista, {
      ...DEFAULT_FILTERS,
      sources: ["VivaReal"],
      neighborhood: "Centro",
    });
    expect(r2).toHaveLength(0);
  });

  it("test_conta_no_badge_de_filtros_ativos", () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, sources: [] })).toBe(0);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, sources: ["ZAP Imóveis"] })).toBe(1);
  });

  it("test_lista_de_plataformas_vem_dos_proprios_dados", () => {
    // A UI não pode ter lista fixa de plataformas: o portal que some amanhã
    // vira linha morta no dropdown. A lista deriva da base.
    const derivado = [...new Set(lista.map((a) => sourceOf(a)))].sort();
    expect(derivado).toEqual(
      ["Chaves na Mão", "VivaReal", "ZAP Imóveis", "sem origem"].sort(),
    );
  });
});