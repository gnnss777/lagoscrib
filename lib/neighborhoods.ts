// Taxonomia de bairros por Regional (10 Administrações Regionais, Prefeitura).
// Fonte: regionais.curitiba.pr.gov.br + Lista de bairros de Curitiba (75 oficiais).
// Verificado em 22/09/2026. Exceções documentadas inline — não "corrigir" sem
// revalidar na fonte oficial.
// REGRA (LL-006): UI lê daqui — nenhum literal de regional/bairro em componente.

export interface RegionalGroup {
  regional: string;
  neighborhoods: string[];
}

export const REGIONAL_GROUPS: RegionalGroup[] = [
  {
    regional: "Matriz",
    neighborhoods: [
      "Ahú",
      "Alto da Glória",
      "Alto da Rua XV",
      "Batel",
      "Bigorrilho",
      "Bom Retiro",
      "Cabral",
      "Centro",
      "Centro Cívico",
      "Cristo Rei",
      "Hugo Lange",
      "Jardim Botânico",
      "Jardim Social",
      "Juvevê",
      "Mercês",
      "Prado Velho",
      "Rebouças",
      "São Francisco",
    ],
  },
  {
    regional: "Boa Vista",
    neighborhoods: [
      "Abranches",
      "Atuba",
      "Bacacheri",
      "Bairro Alto",
      "Barreirinha",
      "Boa Vista",
      "Cachoeira",
      "Pilarzinho",
      "Santa Cândida",
      "São Lourenço",
      "Taboão",
      "Tingui",
    ],
  },
  {
    regional: "Cajuru",
    neighborhoods: [
      "Cajuru",
      "Capão da Imbuia",
      "Guabirotuba",
      "Jardim das Américas",
      "Tarumã",
      "Uberaba",
    ],
  },
  {
    regional: "Boqueirão",
    neighborhoods: ["Alto Boqueirão", "Boqueirão", "Hauer", "Xaxim"],
  },
  {
    regional: "Pinheirinho",
    neighborhoods: ["Capão Raso", "Fanny", "Lindóia", "Novo Mundo", "Pinheirinho"],
  },
  {
    regional: "Bairro Novo",
    neighborhoods: ["Bairro Novo", "Ganchinho", "Sítio Cercado", "Umbará"],
  },
  {
    regional: "CIC",
    neighborhoods: ["Augusta", "CIC", "São Miguel"],
  },
  {
    regional: "Fazendinha/Portão",
    neighborhoods: [
      "Água Verde",
      "Fazendinha",
      "Guaíra",
      "Parolin",
      "Portão",
      "Santa Quitéria",
      "Seminário",
      "Vila Izabel",
    ],
  },
  {
    regional: "Santa Felicidade",
    neighborhoods: [
      "Butiatuvinha",
      "Campina do Siqueira",
      // Campo Comprido é dividido oficialmente entre Portão (sul) e Santa
      // Felicidade (norte) — agrupado aqui (único, sem dupla contagem).
      "Campo Comprido",
      "Cascatinha",
      "Lamenha Pequena",
      "Mossunguê",
      "Orleans",
      "Santa Felicidade",
      "Santo Inácio",
      "São Braz",
      "São João",
      "Vista Alegre",
    ],
  },
  {
    regional: "Tatuquara",
    neighborhoods: ["Campo de Santana", "Caximba", "Tatuquara"],
  },
];

/**
 * Nome de mercado (NÃO é bairro oficial — Ippuc: junção de Mossunguê, Campo
 * Comprido e Campina do Siqueira, todos desta regional). Os anúncios usam
 * "Ecoville", então o dado entra verbatim e o agrupamento resolve aqui.
 */
export const MARKET_ALIAS_REGIONAL: Record<string, string> = {
  Ecoville: "Santa Felicidade",
  // "Cidade Industrial" é como os anúncios chamam o bairro oficial CIC.
  "Cidade Industrial": "CIC",
};

/** Regional de um bairro do app (ou null se desconhecido). */
export function getRegional(neighborhood: string): string | null {
  for (const g of REGIONAL_GROUPS) {
    if (g.neighborhoods.includes(neighborhood)) return g.regional;
  }
  return MARKET_ALIAS_REGIONAL[neighborhood] ?? null;
}
