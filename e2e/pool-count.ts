import { type Apartment } from "@/lib/data";
import {
  apartments as donoApartments,
  saleApartments as donoSale,
} from "@/lib/data";
import {
  apartments as thaisApartments,
  saleApartments as thaisSale,
} from "@/lib/data-thais";
import { isSale, type TransactionTab } from "@/lib/transaction";
import { type AppProfile, resolveAppProfile } from "@/lib/constants";

// Contagem do pool do PERFIL ATIVO, derivada do dado — nunca de um literal.
//
// Por que não importar "@/lib/base": o next.config.js troca esse alias para a
// base do deploy em build, e o Playwright resolve por tsconfig paths, então
// `@/lib/base` aqui SEMPRE cairia em lib/data.ts (o dono) mesmo com a env
// `thais`. Por isso as DUAS bases são importadas pelo caminho real e a escolha é
// feita em cima de `resolveAppProfile` — a mesma função que app/layout.tsx usa
// para escolher identidade e paleta. O app sob teste serve exatamente um destes
// dois módulos, então o número aqui é o número que o app tem de renderizar.
//
// Substitui os 20 asserts `toHaveCount(89|90)` que quebraram quando a base
// cresceu: o que eles provam ("todos os cards do pool renderizaram") continua
// valendo, sem o literal que volta a quebrar na próxima leva.

export interface BasePool {
  perfil: AppProfile;
  base: string;
  /** Aluguel + venda, na mesma ordem que lib/pool.ts monta (STATIC_POOL). */
  pool: Apartment[];
  total: number;
  sale: number;
  rent: number;
}

function buildPool(perfil: AppProfile, base: string, aluguel: Apartment[], venda: Apartment[]): BasePool {
  const pool = [...aluguel, ...venda];
  const sale = pool.filter(isSale).length;
  return { perfil, base, pool, total: pool.length, sale, rent: pool.length - sale };
}

const BASES: Record<AppProfile, BasePool> = {
  dono: buildPool("dono", "lib/data.ts", donoApartments, donoSale),
  thais: buildPool("thais", "lib/data-thais.ts", thaisApartments, thaisSale),
};

/** Pool do perfil que o `npm run dev`/`next build` serviu (env pública do processo). */
export function activePool(): BasePool {
  return BASES[resolveAppProfile(process.env)];
}

/** Os dois pools — para as provas de isolamento entre clientes. */
export function allPools(): BasePool[] {
  return Object.values(BASES);
}

/** Cards que a grade da busca mostra na aba `tab` (sem filtro nenhum). */
export function expectedCards(tab: TransactionTab = "alugar"): number {
  const base = activePool();
  return tab === "comprar" ? base.sale : base.rent;
}

/**
 * Um imóvel real da base ativa, para assert que dependem do dado (fonte do
 * anúncio, bairro, fotos). Filtra por id: o id vem do DOM (`.card-apartment`
 * tem `data-id`), então o teste não precisa saber qual imóvel vai ver.
 */
export function apartmentById(id: string): Apartment | undefined {
  return activePool().pool.find((a) => a.id === id);
}