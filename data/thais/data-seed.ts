// Seed da base da Thaís (perfis.json → thais.seed). NÃO EDITE lib/data-thais.ts:
// ela é gerada por `python data/coleta/generate.py --perfil=thais`.
//
// Schema idêntico ao de lib/data.ts (mesma interface `Apartment`) para o app
// importar as duas bases com o mesmo tipo. Arrays vazios de propósito: o
// generate.py é que preenche, e ele só acrescenta id que ainda não está aqui.
export interface Photo {
  src: string;
  caption?: string;
}

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
  // IDs por portal (expansão 5 fontes, 22/09/2026) + código da loja origem.
  vivaId?: string;
  olxId?: number;
  apolarId?: string;
  codigoAnunciante?: string;
  condoUnknown?: boolean;
  // Leva dores-consumidor (S001, aditivo — ausente = aluguel, nada quebra)
  transaction?: "aluguel" | "venda";
  salePrice?: number;
  photos?: Photo[];
  floorPlan?: string;
  pets?: string;
  guarantor?: string;
  verifiedAt?: string;
}

// Fonte única: Chaves na Mão (perfis.json → thais.fontes). Teto all-in R$ 8.000
// (perfil), não os R$ 3.600 da base do dono.
// total = aluguel + condomínio + IPTU. Condomínio desconhecido = condo 0 +
// condoUnknown (ADR-001 §4) — nunca valor inventado.
// Telefone vem do coletor; sem campo `phone` no item, o generate.py escreve ""
// e o imóvel fica fora de qualquer lista de contato (cobertura no manifesto).
// Como repopular: coleta → merge.py --perfil=thais → download.py --perfil=thais
// → generate.py --perfil=thais (idempotente).
export const apartments: Apartment[] = [];

// --- VENDA: vazio. Para populate, cada entrada leva transaction: "venda";
// total = salePrice; rent: 0.
export const saleApartments: Apartment[] = [];
