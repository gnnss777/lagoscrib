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
}

export const apartments: Apartment[] = [
  {
    id: "merc-01",
    title: "Apartamento com 3 Quartos",
    neighborhood: "Mercês",
    address: "R. Emiliano Pernetta, 540 - Mercês, Curitiba - PR",
    area: 98,
    bedrooms: 3,
    bathrooms: 2,
    parking: 1,
    rent: 3200,
    condo: 650,
    iptu: 280,
    total: 4130,
    phone: "(41) 3022-5678",
    email: "contato@imobmerc.com",
    link: "https://pr.olx.com.br/regiao-de-curitiba-e-paranagua/imoveis/apartamento-terreo-2-quartos-com-suite-para-locacao-nos-merces-1521530134?lis=listing_1002",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&h=400&fit=crop",
    features: ["Suíte", "Elevador", "Portaria 24h", "Próximo ao parque"],
    description: "Apartamento espaçoso nas Mercés com acabamento de qualidade. Próximo ao parque Barigui e com fácil acesso ao centro da cidade."
  },
  {
    id: "sfranc-01",
    title: "Cobertura Duplex 3 Suítes",
    neighborhood: "São Francisco",
    address: "R. Des. Westphalen, 1200 - São Francisco, Curitiba - PR",
    area: 111,
    bedrooms: 3,
    bathrooms: 4,
    parking: 2,
    rent: 3400,
    condo: 850,
    iptu: 350,
    total: 4600,
    phone: "(41) 3022-0123",
    email: "contato@imobsf.com",
    link: "https://www.olx.com.br",
    image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&h=400&fit=crop",
    features: ["3 Suítes", "Churrasqueira", "Academia", "Portaria 24h", "2 Vagas"],
    description: "Coberture duplex premium no São Francisco. Acabamento de alto padrão, terraço gourmet com churrasqueira e vista panorâmica."
  },
  {
    id: "centro-01",
    title: "Apartamento Centro 2 Quartos",
    neighborhood: "Centro",
    address: "R. XV de Novembro, 890 - Centro, Curitiba - PR",
    area: 67,
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
    rent: 2500,
    condo: 480,
    iptu: 200,
    total: 3180,
    phone: "(41) 99943-7890",
    email: "centro@imobctr.com",
    link: "https://pr.olx.com.br/regiao-de-curitiba-e-paranagua/imoveis/apartamento-residencial-em-curitiba-parana-centro-1535982002?lis=listing_1002",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=400&fit=crop",
    features: ["Elevador", "Portaria 24h", "Mobiliado", "Próximo ao comércio"],
    description: "Apartamento funcional no centro de Curitiba. Ideal para quem busca praticidade e acesso rápido a tudo."
  },
  {
    id: "vizabel-01",
    title: "Apartamento Vila Izabel 3 Quartos",
    neighborhood: "Vila Izabel",
    address: "R. dos Funcionários, 445 - Vila Izabel, Curitiba - PR",
    area: 89,
    bedrooms: 3,
    bathrooms: 2,
    parking: 1,
    rent: 2800,
    condo: 580,
    iptu: 240,
    total: 3620,
    phone: "(41) 99943-7890",
    email: "vilaizabel@vivaimo.com",
    link: "https://www.vivareal.com.br/imovel/apartamento-2-quartos-vila-izabel-bairros-curitiba-com-garagem-81m2-aluguel-RS3250-id-2909968477/?source=ranking,rp",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=400&fit=crop",
    features: ["Suíte", "Elevador", "Salão de Festas", "Próximo ao Shopping"],
    description: "Apartamento bem localizado na Vila Izabel. Região tranquila com ótima infraestrutura e próximo a shopping."
  },
  {
    id: "portao-01",
    title: "Apartamento Portão 3 Quartos Completo",
    neighborhood: "Portão",
    address: "Av. São José, 1560 - Portão, Curitiba - PR",
    area: 95,
    bedrooms: 3,
    bathrooms: 2,
    parking: 2,
    rent: 2900,
    condo: 620,
    iptu: 260,
    total: 3780,
    phone: "(41) 3501-1234",
    email: "portao@vivaimo.com",
    link: "https://www.vivareal.com.br/imovel/apartamento-3-quartos-portao-bairros-curitiba-com-garagem-111m2-aluguel-RS3200-id-2906035632/?source=ranking%2Crp",
    image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600&h=400&fit=crop",
    features: ["Suíte", "Churrasqueira", "Academia", "2 Vagas", "Salão de Festas"],
    description: "Apartamento completo no Portão com excelente custo-benefício. Condomínio com infraestrutura completa."
  },
  {
    id: "aguaverde-01",
    title: "Apartamento Água Verde 2 Suítes",
    neighborhood: "Água Verde",
    address: "R. Alferes Ângelo Sampaio, 780 - Água Verde, Curitiba - PR",
    area: 82,
    bedrooms: 2,
    bathrooms: 2,
    parking: 1,
    rent: 3100,
    condo: 590,
    iptu: 250,
    total: 3940,
    phone: "(41) 3022-4567",
    email: "aguaverde@imobav.com",
    link: "https://www.olx.com.br",
    image: "https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=600&h=400&fit=crop",
    features: ["2 Suítes", "Elevador", "Portaria 24h", "Lavabo"],
    description: "Apartamento elegante no Água Verde. Bairro nobre com ótima segurança e infraestrutura completa."
  },
  {
    id: "batel-01",
    title: "Cobertura Batel 3 Suítes Premium",
    neighborhood: "Batel",
    address: "R. Bispo Dom José, 1690 - Batel, Curitiba - PR",
    area: 105,
    bedrooms: 3,
    bathrooms: 3,
    parking: 2,
    rent: 3400,
    condo: 920,
    iptu: 386,
    total: 4606,
    phone: "(41) 3250-7890",
    email: "batel@imobpremium.com",
    link: "https://www.vivareal.com.br",
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop",
    features: ["3 Suítes", "Churrasqueira", "Piscina", "Academia", "Sauna", "2 Vagas"],
    description: "Cobertura premium no Batel. Acabamento de altíssimo padrão em uma das regiões mais nobres de Curitiba."
  },
  {
    id: "cabral-01",
    title: "Apartamento Cabral 2 Quartos",
    neighborhood: "Cabral",
    address: "R. dos Funcionários, 220 - Cabral, Curitiba - PR",
    area: 74,
    bedrooms: 2,
    bathrooms: 2,
    parking: 1,
    rent: 2650,
    condo: 520,
    iptu: 220,
    total: 3390,
    phone: "(41) 99943-7890",
    email: "cabral@imobcabral.com",
    link: "https://www.olx.com.br",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=400&fit=crop",
    features: ["2 Quartos", "Elevador", "Salão de Festas", "Próximo ao parque"],
    description: "Apartamento aconchegante no Cabral. Região residencial tranquila com fácil acesso ao centro."
  }
,

  {
    id: "zap-aguaverde-01",
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
    phone: "(04) 99619-...",
    email: "",
    link: "https://www.zapimoveis.com.br/imovel/aluguel-apartamento-3-quartos-agua-verde-curitiba-pr-123m2-id-2912679822/",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&h=400&fit=crop",
    features: ["Aceita animais", "3 quartos", "2 banheiros", "1 vaga", "Suíte", "Área 123m²"],
    description: "Apartamento amplo com 123m² em uma das regiões mais valorizadas da cidade. Aceita animais. Próximo à Maternidade Curitiba, UniFacear, Hospital IPO e Arena da Baixada."
  }

];