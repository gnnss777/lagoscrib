export interface Apartment {
  id: string;
  title: string;
  neighborhood: string;
  address: string;
  area: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  rent: number;
  condo: number;
  iptu: number;
  total: number;
  phone: string;
  email: string;
  link: string;
  image: string;
  features: string[];
  description: string;
  // Banco de links (pesquisa real, sessão 2026-09-22)
  source?: string;
  zapId?: string;
  condoUnknown?: boolean;
}

// Dados REAIS validados em 22/09/2026 (Zap Imóveis, HTTP 200).
// Filtro: 3+ quartos, vazio/semi, aluguel+condomínio ≤ R$4.500, ≤3,5km da Praça Tiradentes.
// total = aluguel líquido + condomínio + IPTU. Telefones/e-mails mascarados nos portais:
// contato sempre pelo link do anúncio original.
// Simulados originais preservados em data/apartamentos.json (backup).
export const apartments: Apartment[] = [
  {
    id: "zap-aguaverde-castro-123",
    title: "Apartamento com 3 Quartos - Água Verde",
    neighborhood: "Água Verde",
    address: "Rua Castro - Água Verde, Curitiba - PR",
    area: 123,
    bedrooms: 3,
    bathrooms: 2,
    parking: 1,
    rent: 2350,
    condo: 0,
    iptu: 0,
    total: 2350,
    phone: "",
    email: "",
    link: "https://www.zapimoveis.com.br/imovel/aluguel-apartamento-3-quartos-agua-verde-curitiba-pr-123m2-id-2912679822/",
    image: "/imoveis/zap-aguaverde-castro-123.webp",
    features: ["1 suíte", "Aceita animais", "123m²", "Condomínio a confirmar"],
    description: "Apartamento amplo com 123m² em uma das regiões mais valorizadas da cidade. Aceita animais. Próximo à Maternidade Curitiba, UniFacear, Hospital IPO e Arena da Baixada. Imobiliária Querolar. Condomínio não informado no anúncio — confirmar antes de visitar.",
    source: "Zap Imóveis · Querolar",
    zapId: "2912679822",
    condoUnknown: true,
  },
  {
    id: "zap-aguaverde-raul-90",
    title: "Apartamento com 3 Quartos - Água Verde",
    neighborhood: "Água Verde",
    address: "Rua Doutor Raul Carneiro Filho, 229 - Água Verde, Curitiba - PR",
    area: 90,
    bedrooms: 3,
    bathrooms: 2,
    parking: 1,
    rent: 2500,
    condo: 580,
    iptu: 140,
    total: 3220,
    phone: "",
    email: "",
    link: "https://www.zapimoveis.com.br/imovel/aluguel-apartamento-3-quartos-agua-verde-curitiba-pr-90m2-id-2912831367/",
    image: "/imoveis/zap-aguaverde-raul-90.webp",
    features: ["3 quartos amplos", "Cozinha com armários", "Depósito", "Aceita animais", "2º andar"],
    description: "03 quartos amplos, sala, copa, cozinha com armários, lavanderia com tanque e aquecedor, depósito, 02 banheiros e 01 vaga para carro grande. A poucos metros da Av. Presidente Kennedy. Nakayoshi Imóveis (Creci 02171-J-PR).",
    source: "Zap Imóveis · Nakayoshi Imóveis",
    zapId: "2912831367",
  },
  {
    id: "zap-ahu-eca-78",
    title: "Apartamento com 3 Quartos - Ahú (Ed. Taiti)",
    neighborhood: "Ahú",
    address: "Rua Eça de Queiroz, 1092 - Ahú, Curitiba - PR",
    area: 78,
    bedrooms: 3,
    bathrooms: 1,
    parking: 1,
    rent: 3000,
    condo: 0,
    iptu: 136,
    total: 3136,
    phone: "",
    email: "",
    link: "https://www.zapimoveis.com.br/imovel/aluguel-apartamento-3-quartos-com-salao-de-festas-ahu-curitiba-pr-78m2-id-2912848342/",
    image: "/imoveis/zap-ahu-eca-78.webp",
    features: ["Sala com sacada", "Cozinha integrada", "Salão de festas", "4º andar", "Condomínio a confirmar"],
    description: "78m² privativos, 03 dormitórios, sala ampla com sacada, cozinha integrada à área de serviço. Edifício Taiti com portaria, salão de festas e churrasqueira. Próximo ao Museu Oscar Niemeyer e Bosque do Papa. Casa Ao Lado Imóveis. Condomínio a confirmar.",
    source: "Zap Imóveis · Casa Ao Lado Imóveis",
    zapId: "2912848342",
    condoUnknown: true,
  },
  {
    id: "zap-centro-comendador-130",
    title: "Apartamento com 3 Quartos - Centro (Ed. Baêta de Faria)",
    neighborhood: "Centro",
    address: "Rua Comendador Araújo, 100 - Centro, Curitiba - PR",
    area: 130,
    bedrooms: 3,
    bathrooms: 2,
    parking: 1,
    rent: 2800,
    condo: 672,
    iptu: 157,
    total: 3629,
    phone: "",
    email: "",
    link: "https://www.zapimoveis.com.br/imovel/aluguel-apartamento-3-quartos-centro-curitiba-pr-130m2-id-2912933319/",
    image: "/imoveis/zap-centro-comendador-130.webp",
    features: ["130m²", "Piso em madeira", "Cozinha planejada", "7º andar com elevador", "Ótimo preço"],
    description: "Sala para 2 ambientes com piso em madeira, cozinha com armários planejados, 3 dormitórios amplos e 1 vaga. Próximo à Praça Osório e Av. Vicente Machado. Casa Prates Imóveis — sem fiador, seguro fiança a partir de 10% do aluguel.",
    source: "Zap Imóveis · Casa Prates Imóveis",
    zapId: "2912933319",
  },
  {
    id: "zap-centro-bufren-96",
    title: "Apartamento com 3 Quartos - Centro",
    neighborhood: "Centro",
    address: "Rua Alfredo Bufren, 285 - Centro, Curitiba - PR",
    area: 96,
    bedrooms: 3,
    bathrooms: 2,
    parking: 0,
    rent: 2600,
    condo: 750,
    iptu: 155,
    total: 3505,
    phone: "",
    email: "",
    link: "https://www.zapimoveis.com.br/imovel/aluguel-apartamento-3-quartos-centro-curitiba-pr-96m2-id-2913256057/",
    image: "/imoveis/zap-centro-bufren-96.webp",
    features: ["19º andar", "Dormitório de serviço", "SEM GARAGEM", "Próx. Praça Santos Andrade"],
    description: "3 dormitórios, sala para 2 ambientes, cozinha, banheiro social, lavanderia e dormitório com banheiro de serviço. Junto à Praça Santos Andrade e UFPR. Osvaldo Nakamura. Atenção: sem vaga de garagem.",
    source: "Zap Imóveis · Osvaldo Nakamura",
    zapId: "2913256057",
  },
  {
    id: "zap-juveve-goulin-66",
    title: "Apartamento com 3 Quartos - Juvevê (reformado)",
    neighborhood: "Juvevê",
    address: "Rua Doutor Goulin, 1226 - Juvevê, Curitiba - PR",
    area: 66,
    bedrooms: 3,
    bathrooms: 2,
    parking: 1,
    rent: 3600,
    condo: 487,
    iptu: 87,
    total: 4174,
    phone: "",
    email: "",
    link: "https://www.zapimoveis.com.br/imovel/aluguel-apartamento-3-quartos-com-playground-juveve-curitiba-pr-66m2-id-2909577516/",
    image: "/imoveis/zap-juveve-goulin-66.webp",
    features: ["1 suíte", "Reformado", "Cozinha planejada", "Espaço gourmet", "SEM ELEVADOR (3º andar)"],
    description: "Reformado no Juvevê: 3 quartos sendo 1 suíte, sala em 2 ambientes integrada à cozinha com planejados, 1 vaga privativa. Condomínio com espaço gourmet, playground e bicicletário. 3º andar sem elevador. Sillos Imóveis.",
    source: "Zap Imóveis · Sillos Imóveis",
    zapId: "2909577516",
  },
  {
    id: "zap-cabral-manoel-104",
    title: "Apartamento com 3 Quartos - Cabral (andar alto)",
    neighborhood: "Cabral",
    address: "Rua Doutor Manoel Pedro, 470 ap. 1401 - Cabral, Curitiba - PR",
    area: 104,
    bedrooms: 3,
    bathrooms: 3,
    parking: 2,
    rent: 2950,
    condo: 1174,
    iptu: 288,
    total: 4412,
    phone: "",
    email: "",
    link: "https://www.zapimoveis.com.br/imovel/aluguel-apartamento-3-quartos-com-cozinha-cabral-curitiba-pr-104m2-id-2912447929/",
    image: "/imoveis/zap-cabral-manoel-104.webp",
    features: ["1 suíte", "Todos com armários", "2 vagas", "Andar alto", "Portaria 24h"],
    description: "Andar alto com vista permanente: 3 quartos sendo 1 suíte (todos com armários), sala 2 ambientes com sacada, cozinha com armários, 2 vagas no subsolo. Salão de festas e churrasqueira, portaria 24h. Próximo ao Terminal do Cabral. AKG Imóveis.",
    source: "Zap Imóveis · AKG Imóveis",
    zapId: "2912447929",
  },
];
