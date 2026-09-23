import type { Apartment } from "@/lib/data";
import { pricePerM2 } from "@/lib/pricing";
import { NEIGHBORHOOD_ALL } from "@/lib/constants";

// Núcleo puro dos filtros avançados (S008, ADR-003). Sem React, sem
// localStorage — TDD RED→GREEN. Painel/ordenação vão para e2e/filtros.spec.ts.
//
// Regra dura: dado ausente (undefined) nunca exclui — o imóvel passa no grupo.
// Motivo: schema aditivo (S001); não excluir o que não se sabe.

export type PetsFilter = "all" | "yes" | "no";

export type FurnishedFilter = "all" | "yes" | "no";

export type SortOption =
  | "recentes"
  | "menor-preco"
  | "maior-preco"
  | "menor-preco-m2"
  | "maior-area";

export interface FilterState {
  search: string;
  neighborhood: string;
  bedroomsMin: number;
  bathroomsMin: number;
  parkingMin: number;
  priceMin: number | null;
  priceMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  condoMax: number | null;
  noCondo: boolean;
  furnished: FurnishedFilter;
  pets: PetsFilter;
  facilities: string[];
  status: string;
  sort: SortOption;
}

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  neighborhood: NEIGHBORHOOD_ALL,
  bedroomsMin: 0,
  bathroomsMin: 0,
  parkingMin: 0,
  priceMin: null,
  priceMax: null,
  areaMin: null,
  areaMax: null,
  condoMax: null,
  noCondo: false,
  furnished: "all",
  pets: "all",
  facilities: [],
  status: "todos",
  sort: "recentes",
};

/** Normaliza p/ matching: minúsculas, sem acento, sem espaços extras. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Uma feature cobre a facilidade quando a contém SEM negação.
 * "9º andar com elevador" casa com "Elevador"; "SEM ELEVADOR" não casa.
 */
export function facilityMatches(feature: string, facility: string): boolean {
  const feat = normalizeText(feature);
  const fac = normalizeText(facility);
  if (!feat.includes(fac)) return false;
  return (
    !feat.includes(`sem ${fac}`) &&
    !feat.includes(`sem${fac}`) &&
    !feat.includes(`s/${fac}`) &&
    !feat.includes(`s/ ${fac}`)
  );
}

function acceptsPets(a: Apartment): boolean {
  const petsField = normalizeText(a.pets ?? "");
  // "não aceita" nunca é aceite — o substring "aceita" engana o includes.
  if (petsField.includes("nao")) return false;
  if (/aceita|\bsim\b|pets?(\s|-|$)/.test(petsField) && petsField) return true;
  return (a.features ?? []).some((f) => {
    const feat = normalizeText(f);
    if (feat.includes("nao aceita") || feat.includes("nao aceitam")) return false;
    return (
      feat.includes("aceita animais") ||
      feat.includes("aceita pet") ||
      feat.includes("aceitam animais") ||
      feat.includes("aceitam pet")
    );
  });
}

function rejectsPets(a: Apartment): boolean {
  const hay = [normalizeText(a.pets ?? ""), ...((a.features ?? []).map(normalizeText))].join(" ");
  return hay.includes("nao aceita") || hay.includes("proibido animais") || hay.includes("proibido pet");
}

/** Preço filtrável/ordenável: venda = salePrice; aluguel = total. */
export function effectiveFilterPrice(a: Apartment): number | null {
  const price = a.transaction === "venda" ? (a.salePrice ?? a.total) : a.total;
  return typeof price === "number" && !Number.isNaN(price) ? price : null;
}

export type StatusGetter = (id: string) => string;

/**
 * Filtra a lista (AND entre grupos; AND dentro de facilidades).
 * Não ordena — use applySort sobre o resultado.
 */
export function applyFilters(
  list: Apartment[],
  f: FilterState,
  getStatus: StatusGetter = () => "novo"
): Apartment[] {
  const q = normalizeText(f.search);
  return list.filter((a) => {
    if (
      q &&
      !normalizeText(`${a.title ?? ""} ${a.neighborhood ?? ""} ${a.address ?? ""}`).includes(q)
    )
      return false;
    if (f.neighborhood !== NEIGHBORHOOD_ALL && a.neighborhood !== f.neighborhood)
      return false;
    if (f.bedroomsMin > 0 && a.bedrooms != null && a.bedrooms < f.bedroomsMin)
      return false;
    if (f.bathroomsMin > 0 && a.bathrooms != null && a.bathrooms < f.bathroomsMin)
      return false;
    if (f.parkingMin > 0 && a.parking != null && a.parking < f.parkingMin)
      return false;

    const price = effectiveFilterPrice(a);
    if (f.priceMin != null && price != null && price < f.priceMin) return false;
    if (f.priceMax != null && price != null && price > f.priceMax) return false;

    if (f.areaMin != null && a.area != null && a.area < f.areaMin) return false;
    if (f.areaMax != null && a.area != null && a.area > f.areaMax) return false;

    if (f.noCondo && (a.condo !== 0 || a.condoUnknown)) return false;
    if (f.condoMax != null && !a.condoUnknown && a.condo != null && a.condo > f.condoMax)
      return false;

    // Mobiliado 3 estados: "yes" exige (salvo sem informação — regra 3);
    // "no" exclui quem declara; sem features passa nos dois lados.
    const hasFurnished = (a.features ?? []).some((feat) =>
      normalizeText(feat).includes("mobiliado")
    );
    if (f.furnished === "yes" && !hasFurnished && (a.features ?? []).length > 0)
      return false;
    if (f.furnished === "no" && hasFurnished) return false;

    if (f.pets === "yes" && rejectsPets(a)) return false;
    if (f.pets === "no" && acceptsPets(a)) return false;

    const features = a.features ?? [];
    if (
      features.length > 0 &&
      !f.facilities.every((fac) =>
        features.some((feat) => facilityMatches(feat, fac))
      )
    )
      return false;

    if (f.status !== "todos" && getStatus(a.id) !== f.status) return false;

    return true;
  });
}

type SortableApartment = Apartment & {
  verifiedAt?: string;
  createdAt?: string;
};

/** Ordenação client-side, estável (empate preserva a ordem de entrada). */
export function applySort(list: Apartment[], sort: SortOption): Apartment[] {
  const withIndex = (list as SortableApartment[]).map((a, i) => ({ a, i }));
  // Nulo (sem preço) sempre por último, nas duas direções — desconhecido
  // não pode posar de mais caro nem de mais barato.
  const priceKey = (a: SortableApartment): number | null =>
    effectiveFilterPrice(a);
  const priceOr = (a: SortableApartment, fallback: number): number =>
    priceKey(a) ?? fallback;
  const timeOf = (a: SortableApartment): number => {
    const raw = a.verifiedAt ?? a.createdAt;
    const t = raw ? Date.parse(raw) : NaN;
    return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
  };
  const by = (diff: (x: SortableApartment, y: SortableApartment) => number) =>
    [...withIndex]
      .sort((x, y) => diff(x.a, y.a) || x.i - y.i)
      .map(({ a }) => a);

  switch (sort) {
    case "menor-preco":
      return by(
        (x, y) =>
          priceOr(x, Number.POSITIVE_INFINITY) -
          priceOr(y, Number.POSITIVE_INFINITY)
      );
    case "maior-preco":
      return by(
        (x, y) =>
          priceOr(y, Number.NEGATIVE_INFINITY) -
          priceOr(x, Number.NEGATIVE_INFINITY)
      );
    case "menor-preco-m2":
      return by(
        (x, y) =>
          pricePerM2(
            priceOr(x, Number.POSITIVE_INFINITY),
            x.area
          ) -
          pricePerM2(priceOr(y, Number.POSITIVE_INFINITY), y.area)
      );
    case "maior-area":
      return by((x, y) => (y.area ?? 0) - (x.area ?? 0));
    case "recentes":
      return by((x, y) => timeOf(y) - timeOf(x));
  }
}

/**
 * Grupos ativos p/ o badge "Mais filtros (N)": preço e área contam 1 por
 * grupo (min ou max); cada facilidade conta 1 (remoção individual).
 * Ordenação não é filtro — não conta.
 */
export function countActiveFilters(f: FilterState): number {
  let n = 0;
  if (normalizeText(f.search)) n += 1;
  if (f.neighborhood !== NEIGHBORHOOD_ALL) n += 1;
  if (f.bedroomsMin > 0) n += 1;
  if (f.bathroomsMin > 0) n += 1;
  if (f.parkingMin > 0) n += 1;
  if (f.priceMin != null || f.priceMax != null) n += 1;
  if (f.areaMin != null || f.areaMax != null) n += 1;
  if (f.condoMax != null) n += 1;
  if (f.noCondo) n += 1;
  if (f.furnished !== "all") n += 1;
  if (f.pets !== "all") n += 1;
  n += f.facilities.length;
  if (f.status !== "todos") n += 1;
  return n;
}
