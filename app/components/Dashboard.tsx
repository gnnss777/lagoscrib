"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  SignOut,
  MagnifyingGlass,
  FunnelSimple,
  Buildings,
  MapPin,
  SquaresFour,
  Kanban,
} from "@phosphor-icons/react";
import { type Apartment } from "@/lib/data";
import {
  COMPARE_MAX,
  COMPARE_MIN,
  VIEW_BUSCA_LABEL,
  VIEW_MODE_ANNOUNCE,
  VIEW_MODE_GROUP_LABEL,
  VIEW_MODE_STORAGE_KEY,
  VIEW_MODE_STORAGE_VERSION,
  VIEW_QUADRO_LABEL,
  type ViewMode,
} from "@/lib/constants";
import {
  FILTER_DEBOUNCE_MS,
  FILTERS_STORAGE_KEY,
  FILTERS_STORAGE_VERSION,
  NEIGHBORHOOD_ALL,
  SORT_OPTIONS,
} from "@/lib/constants";
import { toggleCompareSelection } from "@/lib/compare";
import { getRegional, REGIONAL_GROUPS } from "@/lib/neighborhoods";
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
import { getAllApartments } from "@/lib/pool";
import { isKanbanExcludedStatus, type StatusType } from "@/lib/kanban";
import { useApp } from "@/lib/AppContext";
import ApartmentCard from "./ApartmentCard";
import AddApartmentForm from "./AddApartmentForm";
import DetailModal from "./DetailModal";
import CompareModal from "./CompareModal";
import FilterPanel from "./FilterPanel";
import KanbanSection from "./KanbanSection";

const STATUS_FILTERS: { value: StatusType | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "novo", label: "Não visitado" },
  { value: "contactado", label: "Contactado" },
  { value: "respondido", label: "Respondido" },
  { value: "agendado", label: "Agendado" },
  { value: "feita", label: "Visita feita" },
  { value: "negociacao", label: "Negociação" },
  { value: "aprovado", label: "Aprovado" },
  { value: "recusado", label: "Recusado" },
];

const DASHBOARD_STATUS_OPTIONS: { value: StatusType; label: string }[] = [
  { value: "novo", label: "novo" },
  { value: "contactado", label: "contatado" },
  { value: "visita", label: "visita" },
  { value: "agendado", label: "agendado" },
  { value: "visitado", label: "visitado" },
  { value: "descartado", label: "descartado" },
  { value: "inativo", label: "inativo" },
];

export default function Dashboard() {
  const { username, logout, getStatus, moveCardTo, updateStatus } = useApp();
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
  // Modo de visualização (leva unificacao-busca-quadro): busca e quadro são o
  // mesmo pool. O modo é estado local persistido — nada de abrir overlay.
  const [view, setView] = useState<ViewMode>("busca");
  const [viewHydrated, setViewHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { version?: unknown; mode?: unknown };
        if (parsed?.version === VIEW_MODE_STORAGE_VERSION && (parsed.mode === "busca" || parsed.mode === "quadro")) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação pós-mount, padrão AppContext
          setView(parsed.mode);
        }
      }
    } catch {
      // ignore
    }
    setViewHydrated(true);
  }, []);

  useEffect(() => {
    if (!viewHydrated) return;
    try {
      localStorage.setItem(
        VIEW_MODE_STORAGE_KEY,
        JSON.stringify({ version: VIEW_MODE_STORAGE_VERSION, mode: view }),
      );
    } catch {
      // ignore
    }
  }, [view, viewHydrated]);

  // Sem atalho de teclado para trocar de modo: o Esc já é do board (fecha
  // detalhe inline, menu e dialog "+N restantes"). O caminho do modo é o
  // seletor do header, e é o único.
  const setViewMode = (mode: ViewMode) => setView(mode);

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

  // Prospectar da busca em ≤2 ações (AC-5): joga p/ Não visitado (topo) e
  // vai para o quadro. Reversível (voltar = mover de volta).
  const handleProspect = (apartment: Apartment) => {
    moveCardTo(apartment.id, "novo", 0);
    setSelectedApartment(null);
    setViewMode("quadro");
  };

  const allApartments = getAllApartments();

  // Bairros dinâmicos (fix S009): incluem imóveis novos do usuário.
  // Sem useMemo de propósito — lista curta, recomputa barato a cada render.
  const neighborhoods: string[] = [
    NEIGHBORHOOD_ALL,
    ...Array.from(new Set(allApartments.map((a) => a.neighborhood))),
  ];

  // Agrupamento por Regional (lib/neighborhoods.ts) só p/ exibição do
  // dropdown — o filtro continua por igualdade exata de bairro.
  // useMemo: estabiliza a identidade p/ o React Compiler (preserve-manual-memoization).
  const neighborhoodGroups: { label: string | null; items: string[] }[] =
    useMemo(
      () => [
        ...REGIONAL_GROUPS.map((g) => ({
          label: `Regional ${g.regional}`,
          items: neighborhoods.filter((n) => getRegional(n) === g.regional),
        })).filter((g) => g.items.length > 0),
        {
          label: null,
          items: neighborhoods.filter(
            (n) => n !== NEIGHBORHOOD_ALL && getRegional(n) === null
          ),
        },
      ],
      // eslint-disable-next-line react-hooks/exhaustive-deps -- neighborhoods deriva de allApartments (identidade estável por render c/ dados estáticos + user add)
      [allApartments]
    );

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
  // Kanban mostra o pool COMPLETO (aluguel+venda), não só a aba ativa.
  const kanbanApartments = allApartments.filter(
    (apartment) => !isKanbanExcludedStatus(getStatus(apartment.id)),
  );

  const filteredApartments = useMemo(() => {
    return applySort(
      applyFilters(tabApartments, filters, getStatus),
      filters.sort
    );
  }, [filters, getStatus, tabApartments]);

  const activeFilterCount = countActiveFilters(filters);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-md border-b border-line">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-taxi to-taxi-strong flex items-center justify-center">
              <Buildings size={20} weight="bold" className="text-ink" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-ink tracking-tight">
                Curitiba Apartamentos
              </h1>
              <p className="text-xs text-muted">
                {view === "busca"
                  ? `${tabApartments.length} apartamentos encontrados`
                  : `${kanbanApartments.length} imóveis no funil`}
              </p>
            </div>
          </div>

          {/* Modo atual anunciado: quem navega por leitor de tela (ou pelo
              print) sabe em que forma de visualização está. */}
          <p data-testid="view-mode-status" className="sr-only" role="status" aria-live="polite">
            {VIEW_MODE_ANNOUNCE[view]}
          </p>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Modo de visualização: mesmo pool, duas formas de ver. O
                botão "Olá" virou o rótulo de quem está logado (não abre mais
                nada) — antes ele abria o modal do kanban. */}
            <div
              role="group"
              aria-label={VIEW_MODE_GROUP_LABEL}
              className="flex items-center gap-1 p-1 rounded-full border border-line bg-card"
            >
              {(
                [
                  { mode: "busca" as const, label: VIEW_BUSCA_LABEL, Icon: SquaresFour },
                  { mode: "quadro" as const, label: VIEW_QUADRO_LABEL, Icon: Kanban },
                ] satisfies { mode: ViewMode; label: string; Icon: typeof SquaresFour }[]
              ).map(({ mode, label, Icon }) => {
                const ativo = view === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    aria-pressed={ativo}
                    data-view-mode={mode}
                    className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 min-h-11 rounded-full text-sm font-semibold transition-colors ${
                      ativo
                        ? "bg-taxi text-ink shadow-sm"
                        : "text-ink-soft hover:text-ink hover:bg-sand"
                    }`}
                  >
                    <Icon size={16} weight={ativo ? "bold" : "regular"} />
                    <span className="hidden xs:inline sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>
            <span className="text-sm text-ink-soft hidden lg:inline">
              Olá, <span className="text-amberink font-medium">{username}</span>
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-ink-soft hover:text-ink hover:bg-sand rounded-full transition-colors text-sm"
            >
              <SignOut size={16} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Uma tela, dois modos. Busca e quadro compartilham o mesmo pool e o
          mesmo header; só o corpo abaixo troca. O estado do outro modo fica
          intacto porque nada é desmontado que guarde estado de filtro. */}
      {view === "quadro" ? (
        <main
          key="quadro"
          className="px-4 sm:px-6 py-6"
          data-testid="view-quadro"
        >
          <KanbanSection
            apartments={kanbanApartments}
            onSelect={setSelectedApartment}
          />
        </main>
      ) : (
        <main
          key="busca"
          data-testid="view-busca"
          className="max-w-7xl mx-auto px-6 py-8"
        >
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
              className="block text-xs font-medium text-ink-soft mb-1"
            >
              Buscar
            </label>
            <div className="relative">
              <MagnifyingGlass
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
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
              className="block text-xs font-medium text-ink-soft mb-1"
            >
              Bairro
            </label>
            <div className="relative">
              <MapPin
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <select
                id="dash-bairro"
                value={filters.neighborhood}
                onChange={(e) =>
                  setFilters({ ...filters, neighborhood: e.target.value })
                }
                className="input-field pl-10 pr-8 appearance-none cursor-pointer min-w-[160px] min-h-11"
              >
                {neighborhoods.includes(NEIGHBORHOOD_ALL) && (
                  <option value={NEIGHBORHOOD_ALL}>{NEIGHBORHOOD_ALL}</option>
                )}
                {neighborhoodGroups.map((g) =>
                  g.label ? (
                    <optgroup key={g.label} label={g.label}>
                      {g.items.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    g.items.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))
                  )
                )}
              </select>
            </div>
          </div>

          {/* Status filter */}
          <div>
            <label
              htmlFor="dash-status"
              className="block text-xs font-medium text-ink-soft mb-1"
            >
              Status
            </label>
            <div className="relative">
              <FunnelSimple
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
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
              className="block text-xs font-medium text-ink-soft mb-1"
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
          className="flex gap-1 p-1 mb-6 w-fit rounded-full bg-card border border-line shadow-sm"
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
              className={`px-6 py-2.5 min-h-11 rounded-full text-sm font-semibold transition-colors ${
                tab === value
                  ? "bg-taxi text-ink shadow-sm"
                  : "text-muted hover:text-ink"
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
          <p className="text-sm text-ink-soft" aria-live="polite">
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
            {filteredApartments.map((apartment, index) => {
              const status = getStatus(apartment.id);

              return (
                <div key={apartment.id} className="space-y-2">
                  <ApartmentCard
                    apartment={apartment}
                    index={index}
                    onSelect={setSelectedApartment}
                    compareChecked={compareIds.includes(apartment.id)}
                    onToggleCompare={toggleCompare}
                  />
                  <div
                    role="tablist"
                    aria-label={`Status de ${apartment.title}`}
                    className="flex flex-wrap gap-1 rounded-xl border border-line bg-card p-2"
                  >
                    {DASHBOARD_STATUS_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-label={label}
                        aria-selected={status === value}
                        data-status={value}
                        onClick={() => updateStatus(apartment.id, value)}
                        className={`min-h-11 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                          status === value
                            ? "bg-taxi text-ink shadow-sm"
                            : "text-ink-soft hover:bg-sand hover:text-ink"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Buildings size={48} className="mx-auto text-muted mb-4" />
            <p className="text-ink-soft text-lg mb-2">
              Nenhum apartamento encontrado
            </p>
            <p className="text-muted text-sm mb-4">
              {activeFilterCount > 0
                ? `Nenhum imóvel com os ${activeFilterCount} filtro${activeFilterCount > 1 ? "s" : ""} atuais — ajuste os filtros`
                : "Tente ajustar os filtros de busca"}
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="px-4 py-2.5 min-h-11 rounded-full text-sm font-semibold border border-inputbd text-ink bg-card hover:border-ink transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </motion.div>
        )}
        </main>
      )}

      {/* CompareBar sticky (S005): contador 2–4 + bloqueio visível */}
      {compareIds.length > 0 && (
        <div
          data-testid="compare-bar"
          className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-line shadow-[0_-4px_16px_rgba(26,26,26,0.08)]"
        >
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              <span className="font-mono font-bold text-amberink">
                {compareIds.length}
              </span>{" "}
              selecionado{compareIds.length > 1 ? "s" : ""} (máx {COMPARE_MAX})
            </p>
            {compareBlocked && (
              <p
                data-testid="compare-blocked"
                role="alert"
                className="text-sm text-amberink"
              >
                Máximo de {COMPARE_MAX} imóveis — desmarque um para trocar.
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={clearCompare}
                className="px-4 py-2.5 min-h-11 rounded-full text-sm font-medium border border-inputbd text-ink hover:border-ink transition-colors"
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
                className="px-4 py-2.5 min-h-11 rounded-full text-sm font-semibold bg-taxi text-ink hover:bg-taxi-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
          onProspect={handleProspect}
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
