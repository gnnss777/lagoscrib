"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import {
  SignOut,
  MagnifyingGlass,
  FunnelSimple,
  Buildings,
  MapPin,
} from "@phosphor-icons/react";
import {
  apartments as staticApartments,
  saleApartments as staticSaleApartments,
  type Apartment,
} from "@/lib/data";
import { COMPARE_MAX, COMPARE_MIN } from "@/lib/constants";
import {
  FILTER_DEBOUNCE_MS,
  FILTERS_STORAGE_KEY,
  FILTERS_STORAGE_VERSION,
  NEIGHBORHOOD_ALL,
  SORT_OPTIONS,
} from "@/lib/constants";
import { toggleCompareSelection } from "@/lib/compare";
import {
  applyFilters,
  applySort,
  countActiveFilters,
  DEFAULT_FILTERS,
  type FilterState,
  type SortOption,
} from "@/lib/filters";
import {
  filterByTransaction,
  type TransactionTab,
} from "@/lib/transaction";
import { useApp, STATUS_LABELS, type StatusType } from "@/lib/AppContext";
import ApartmentCard from "./ApartmentCard";
import AddApartmentForm from "./AddApartmentForm";
import DetailModal from "./DetailModal";
import CompareModal from "./CompareModal";
import FilterPanel from "./FilterPanel";

const STATIC_POOL: Apartment[] = [...staticApartments, ...staticSaleApartments];

// Combinar apartamentos estáticos (aluguel + venda) com novos do usuário
// (sem transaction = aluguel, aditivo S001).
const getAllApartments = (): Apartment[] => {
  try {
    const stored = localStorage.getItem("apartamentos-app-new");
    if (stored) {
      const newApts: Apartment[] = JSON.parse(stored);
      return [...STATIC_POOL, ...newApts];
    }
  } catch {
    // ignore
  }
  return STATIC_POOL;
};

const STATUS_FILTERS: { value: StatusType | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "novo", label: "Não visitado" },
  { value: "agendado", label: "Agendado" },
  { value: "feita", label: "Visita feita" },
  { value: "negociacao", label: "Negociação" },
  { value: "aprovado", label: "Aprovado" },
  { value: "recusado", label: "Recusado" },
];

export default function Dashboard() {
  const { username, logout, getStatus } = useApp();
  // Filtros avançados (S009): estado único + persistência aditiva em chave
  // própria (nunca toca "apartamentos-app-state").
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  // Aba ativa (S006): Alugar exclui vendas; Comprar só vendas.
  const [tab, setTab] = useState<TransactionTab>("alugar");
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(
    null
  );
  // Comparação (S005): seleção de ids + aviso de bloqueio + modal.
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareBlocked, setCompareBlocked] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const toggleCompare = (apartment: Apartment) => {
    const result = toggleCompareSelection(compareIds, apartment.id);
    setCompareIds(result.selected);
    setCompareBlocked(result.blocked);
  };

  const clearCompare = () => {
    setCompareIds([]);
    setCompareBlocked(false);
    setCompareOpen(false);
  };

  const allApartments = getAllApartments();

  // Bairros dinâmicos (fix S009): incluem imóveis novos do usuário.
  // Sem useMemo de propósito — lista curta, recomputa barato a cada render.
  const neighborhoods: string[] = [
    NEIGHBORHOOD_ALL,
    ...Array.from(new Set(allApartments.map((a) => a.neighborhood))),
  ];

  // Hidrata filtros salvos (SSR-safe: localStorage só no client).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.version === FILTERS_STORAGE_VERSION && parsed.filters) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação pós-mount, padrão AppContext
          setFilters({ ...DEFAULT_FILTERS, ...parsed.filters });
        }
      }
    } catch {
      // ignore
    }
    setFiltersHydrated(true);
  }, []);

  // Persiste com debounce (evita escrita a cada tecla).
  useEffect(() => {
    if (!filtersHydrated) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          FILTERS_STORAGE_KEY,
          JSON.stringify({ version: FILTERS_STORAGE_VERSION, filters })
        );
      } catch {
        // ignore
      }
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filters, filtersHydrated]);

  const compareApartments = allApartments.filter((a) =>
    compareIds.includes(a.id)
  );

  // Pool da aba ativa — busca, bairro, status e stats operam sobre ele.
  const tabApartments = filterByTransaction(allApartments, tab);

  const filteredApartments = useMemo(() => {
    return applySort(
      applyFilters(tabApartments, filters, getStatus),
      filters.sort
    );
  }, [filters, getStatus, tabApartments]);

  const activeFilterCount = countActiveFilters(filters);

  // Stats refletem a aba ativa (AC-TOGGLE-01).
  const stats = useMemo(() => {
    const all = tabApartments.map((a) => ({ ...a, status: getStatus(a.id) }));
    return {
      total: all.length,
      novo: all.filter((a) => a.status === "novo").length,
      agendado: all.filter((a) => a.status === "agendado").length,
      feita: all.filter((a) => a.status === "feita").length,
      negociacao: all.filter((a) => a.status === "negociacao").length,
      aprovado: all.filter((a) => a.status === "aprovado").length,
      recusado: all.filter((a) => a.status === "recusado").length,
    };
  }, [tabApartments, getStatus]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-navy-950/80 backdrop-blur-md border-b border-navy-700/30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center">
              <Buildings size={20} weight="bold" className="text-navy-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-surface-50 tracking-tight">
                Curitiba Apartamentos
              </h1>
              <p className="text-xs text-surface-500">
                {tabApartments.length} apartamentos encontrados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-surface-400 hidden sm:block">
              Olá, <span className="text-gold-400 font-medium">{username}</span>
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-surface-400 hover:text-surface-50 hover:bg-navy-800/50 rounded-lg transition-colors text-sm"
            >
              <SignOut size={16} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8"
        >
          {[
            { label: "Total", value: stats.total, color: "text-surface-50" },
            { label: "Novos", value: stats.novo, color: "text-surface-400" },
            { label: "Agendados", value: stats.agendado, color: "text-blue-400" },
            { label: "Feitas", value: stats.feita, color: "text-purple-400" },
            { label: "Negociação", value: stats.negociacao, color: "text-gold-400" },
            { label: "Aprovados", value: stats.aprovado, color: "text-green-400" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-navy-900/50 border border-navy-700/30 rounded-xl p-3 text-center"
            >
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-surface-500 mt-0.5">{label}</div>
            </div>
          ))}
        </motion.div>

        {/* Filters (S009: labels visíveis AAA + sort; lógica em lib/filters) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4 mb-4"
        >
          {/* Search */}
          <div className="flex-1">
            <label
              htmlFor="dash-search"
              className="block text-xs font-medium text-surface-400 mb-1"
            >
              Buscar
            </label>
            <div className="relative">
              <MagnifyingGlass
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500"
              />
              <input
                id="dash-search"
                type="text"
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                placeholder="Buscar por título, bairro ou endereço..."
                className="input-field pl-12"
              />
            </div>
          </div>

          {/* Neighborhood filter */}
          <div>
            <label
              htmlFor="dash-bairro"
              className="block text-xs font-medium text-surface-400 mb-1"
            >
              Bairro
            </label>
            <div className="relative">
              <MapPin
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
              />
              <select
                id="dash-bairro"
                value={filters.neighborhood}
                onChange={(e) =>
                  setFilters({ ...filters, neighborhood: e.target.value })
                }
                className="input-field pl-10 pr-8 appearance-none cursor-pointer min-w-[160px] min-h-11"
              >
                {neighborhoods.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status filter */}
          <div>
            <label
              htmlFor="dash-status"
              className="block text-xs font-medium text-surface-400 mb-1"
            >
              Status
            </label>
            <div className="relative">
              <FunnelSimple
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
              />
              <select
                id="dash-status"
                value={filters.status}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    status: e.target.value as StatusType | "todos",
                  })
                }
                className="input-field pl-10 pr-8 appearance-none cursor-pointer min-w-[160px] min-h-11"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sort */}
          <div>
            <label
              htmlFor="dash-sort"
              className="block text-xs font-medium text-surface-400 mb-1"
            >
              Ordenar
            </label>
            <select
              id="dash-sort"
              value={filters.sort}
              onChange={(e) =>
                setFilters({ ...filters, sort: e.target.value as SortOption })
              }
              className="input-field pr-8 appearance-none cursor-pointer min-w-[160px] min-h-11"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* Toggle Alugar|Comprar (S006, UX spec F4, role switch duplo) */}
        <div
          data-testid="transaction-toggle"
          role="group"
          aria-label="Tipo de transação"
          className="flex gap-1 p-1 mb-6 w-fit rounded-xl bg-navy-900/50 border border-navy-700/30"
        >
          {(
            [
              { value: "alugar", label: "Alugar" },
              { value: "comprar", label: "Comprar" },
            ] as { value: TransactionTab; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={value}
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
              className={`px-6 py-2.5 min-h-11 rounded-lg text-sm font-semibold transition-colors ${
                tab === value
                  ? "bg-gold-400 text-navy-950"
                  : "text-surface-400 hover:text-surface-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Painel de filtros avançados (S009) */}
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters(DEFAULT_FILTERS)}
          pool={tabApartments}
          getStatus={getStatus}
          tab={tab}
        />

        {/* Results count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-surface-400" aria-live="polite">
            {filteredApartments.length === tabApartments.length
              ? "Mostrando todos os apartamentos"
              : `${filteredApartments.length} de ${tabApartments.length} apartamentos`}
          </p>
        </div>

        {/* Add new apartment */}
        <div className="mb-6">
          <AddApartmentForm />
        </div>

        {/* Grid */}
        {filteredApartments.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApartments.map((apartment, index) => (
              <ApartmentCard
                key={apartment.id}
                apartment={apartment}
                index={index}
                onSelect={setSelectedApartment}
                compareChecked={compareIds.includes(apartment.id)}
                onToggleCompare={toggleCompare}
              />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Buildings size={48} className="mx-auto text-surface-500 mb-4" />
            <p className="text-surface-400 text-lg mb-2">
              Nenhum apartamento encontrado
            </p>
            <p className="text-surface-500 text-sm mb-4">
              {activeFilterCount > 0
                ? `Nenhum imóvel com os ${activeFilterCount} filtro${activeFilterCount > 1 ? "s" : ""} atuais — ajuste os filtros`
                : "Tente ajustar os filtros de busca"}
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="px-4 py-2.5 min-h-11 rounded-lg text-sm font-semibold border border-navy-600 text-surface-50 hover:border-gold-400/50 transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </motion.div>
        )}
      </main>

      {/* CompareBar sticky (S005): contador 2–4 + bloqueio visível */}
      {compareIds.length > 0 && (
        <div
          data-testid="compare-bar"
          className="fixed bottom-0 inset-x-0 z-40 bg-navy-950/90 backdrop-blur-md border-t border-gold-400/20"
        >
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-surface-200">
              <span className="font-mono font-bold text-gold-400">
                {compareIds.length}
              </span>{" "}
              selecionado{compareIds.length > 1 ? "s" : ""} (máx {COMPARE_MAX})
            </p>
            {compareBlocked && (
              <p
                data-testid="compare-blocked"
                role="alert"
                className="text-sm text-gold-300"
              >
                Máximo de {COMPARE_MAX} imóveis — desmarque um para trocar.
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={clearCompare}
                className="px-4 py-2.5 min-h-11 rounded-lg text-sm font-medium border border-navy-600 text-surface-50 hover:border-gold-400/50 transition-colors"
              >
                Limpar
              </button>
              <button
                data-testid="compare-open"
                onClick={() => setCompareOpen(true)}
                disabled={compareIds.length < COMPARE_MIN}
                title={
                  compareIds.length < COMPARE_MIN
                    ? `Selecione pelo menos ${COMPARE_MIN} imóveis`
                    : "Abrir comparação"
                }
                className="px-4 py-2.5 min-h-11 rounded-lg text-sm font-semibold bg-gold-400 text-navy-950 hover:bg-gold-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Comparar ({compareIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal (key = remount limpa galeria/lightbox por imóvel) */}
      {selectedApartment && (
        <DetailModal
          key={selectedApartment.id}
          apartment={selectedApartment}
          onClose={() => setSelectedApartment(null)}
        />
      )}

      {/* CompareModal: ordem default por custo total efetivo (dentro) */}
      {compareOpen && compareApartments.length >= COMPARE_MIN && (
        <CompareModal
          apartments={compareApartments}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
}
